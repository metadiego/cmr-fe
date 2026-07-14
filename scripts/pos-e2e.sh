#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# POS end-to-end (CURL): corre el flujo completo de Facturación GENERAL contra la
# API y VERIFICA que los cálculos caen donde deben (línea, subtotal, IVU, descuento,
# total). Uso: probar ANTES de afirmar que algo funciona.
#
#   CMR_EMAIL=... CMR_PASS=... ./scripts/pos-e2e.sh            # prod (default)
#   API_BASE=http://localhost:3001 CMR_EMAIL=... CMR_PASS=... ./scripts/pos-e2e.sh
#
# No hardcodea secretos: credenciales por env. Sale con código !=0 si algo falla.
# ------------------------------------------------------------------------------
set -uo pipefail

API="${API_BASE:-https://api.centrodemedicinaregenerativa.com}/api/v1"
SUPA="${SUPA_URL:-https://nbvgriwrtwpwmbdnixeh.supabase.co}"
ANON="${SUPA_ANON:?falta SUPA_ANON}"
EMAIL="${CMR_EMAIL:?falta CMR_EMAIL}"
PASS="${CMR_PASS:?falta CMR_PASS}"
CENTRO="${CENTRO:?falta CENTRO (clinicId)}"

pass=0; fail=0
chk() { # chk "desc" esperado real
  if [ "$2" = "$3" ]; then echo "  ✓ $1 = $3"; pass=$((pass+1));
  else echo "  ✗ $1 → esperado $2, obtuvo $3"; fail=$((fail+1)); fi
}
jq_() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1" 2>/dev/null; }

echo "== auth =="
TOK=$(curl -s "$SUPA/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" -H "User-Agent: Mozilla/5.0" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))")
[ -n "$TOK" ] || { echo "  ✗ sin token"; exit 1; }
H=(-H "Authorization: Bearer $TOK" -H "X-Tenant-ID: $CENTRO" -H "Content-Type: application/json")
G() { curl -s "$API/facturas/$FID" "${H[@]}"; }        # GET factura
F() { G | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(d.get('$1'))"; }  # campo factura
LINE() { G | python3 -c "import sys,json;its=json.load(sys.stdin)['data'].get('items',[]);print(its[0].get('$1') if its else 'NOITEM')"; }

echo "== datos =="
REG=$(curl -s "$API/precios/tipos" "${H[@]}" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];r=[x for x in d if x.get('esDefault')] or [x for x in d if x.get('clave')=='regular'];print(r[0]['id'] if r else '')")
PAC=$(curl -s "$API/facturas/buscar-paciente?q=a&limit=1" "${H[@]}" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(d[0]['id'] if d else '')")
PID="${PROD_ID:-5fca41cd-32cc-4e24-a9da-6a19481d1239}"   # ULTRA HEPATOPATIA (precio lista 9000)
PRECIO_ESPERADO="${PRECIO_ESPERADO:-9000}"
IVU=$(curl -s "$API/precios/impuestos" "${H[@]}" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];r=[x for x in d if x.get('esDefault') and x.get('activo')] or [x for x in d if x.get('activo')];print((r[0]['id'],r[0].get('tasa')) if r else ('',0))" | tr -d "(),'")
IVU_ID=$(echo $IVU | cut -d' ' -f1); TASA=$(echo $IVU | cut -d' ' -f2)
echo "  lista=$REG paciente=$PAC producto=$PID (precio esperado $PRECIO_ESPERADO) ivu=$IVU_ID tasa=$TASA%"

echo "== crear factura general con lista =="
FID=$(curl -s -X POST "$API/facturas" "${H[@]}" -d "{\"pacienteId\":\"$PAC\",\"tipoPrecioId\":\"$REG\"}" | jq_ "d['data']['id']")
echo "  factura=$FID"
chk "factura.tipoPrecioId" "$REG" "$(F tipoPrecioId)"

echo "== A) agregar 1 x producto SIN precio, gravado + impuestoId (como el FE) =="
curl -s -X POST "$API/facturas/$FID/items" "${H[@]}" -d "{\"productoId\":\"$PID\",\"cantidad\":1,\"gravado\":true,\"impuestoId\":\"$IVU_ID\"}" >/dev/null
IID=$(G | python3 -c "import sys,json;its=json.load(sys.stdin)['data'].get('items',[]);print(its[0]['id'] if its else '')")
ESPIVU1=$(python3 -c "v=$PRECIO_ESPERADO*$TASA/100;print(int(v) if v==int(v) else round(v,2))")
ESPTOT1=$(python3 -c "v=$PRECIO_ESPERADO+$PRECIO_ESPERADO*$TASA/100;print(int(v) if v==int(v) else round(v,2))")
chk "línea.precioUnitario" "$PRECIO_ESPERADO" "$(LINE precioUnitario)"
chk "línea.montoImpuesto (IVU $TASA%)" "$ESPIVU1" "$(LINE montoImpuesto)"
chk "línea.total (1x, IVU incl.)" "$ESPTOT1" "$(LINE total)"
chk "factura.subtotal (1x, pre-IVU)" "$PRECIO_ESPERADO" "$(F subtotal)"

echo "== B) subir cantidad a 3 (¿línea y subtotal x3?) =="
curl -s -X PUT "$API/facturas/$FID/items/$IID" "${H[@]}" -d '{"cantidad":3}' >/dev/null
ESP3=$(python3 -c "print($PRECIO_ESPERADO*3)")
ESPTOT3=$(python3 -c "v=$ESP3*(1+$TASA/100);print(int(v) if v==int(v) else round(v,2))")
chk "línea.cantidad" "3" "$(LINE cantidad)"
chk "línea.total (3x, IVU incl.)" "$ESPTOT3" "$(LINE total)"
chk "factura.subtotal (3x, pre-IVU)" "$ESP3" "$(F subtotal)"

echo "== C) descuento global 10% (sobre $ESP3) =="
curl -s -X PUT "$API/facturas/$FID/descuento-global" "${H[@]}" -d '{"tipo":"porcentaje","valor":10}' >/dev/null
ESPDESC=$(python3 -c "v=$ESP3*0.10;print(int(v) if v==int(v) else round(v,2))")
ESPTOT=$(python3 -c "print(round($ESP3-$ESP3*0.10+float('$(F impuesto)' or 0),2))")
chk "factura.descuento (10%)" "$ESPDESC" "$(F descuento)"
echo "  (impuesto=$(F impuesto), total=$(F total))"

echo "== resumen: subtotal/descuento/impuesto/total =="
G | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print('  subtotal=%s descuento=%s impuesto=%s exento=%s TOTAL=%s'%(d.get('subtotal'),d.get('descuento'),d.get('impuesto'),d.get('exento'),d.get('total')))"

echo ""
echo "RESULTADO: $pass OK, $fail FALLOS"
[ "$fail" -eq 0 ] || exit 1
