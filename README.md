# homebridge-cecotec-conga

Plugin Homebridge para robots aspiradores Cecotec Conga X100/X-Treme. Integra con HomeKit: mapa en vivo, Siri (español), avisos, CarPlay, Watch y HomePod.

## Características
- Mapa en vivo en app Casa, Watch, CarPlay y HomePod.
- Siri: "Oye Siri, limpia la cocina con la Conga" (por habitación, modos aspirado/fregado).
- Avisos push/voz: batería, agua limpia/sucia, bolsa llena.
- Token seguro (sin contraseña).
- Soporte completo: HomePod Mini (voz/pantalla), Apple Watch (complicación/hápticos), CarPlay ("Limpiar al llegar").

## Requisitos
- Homebridge v1.7+.
- Node.js v18+.
- Cuenta Cecotec (app oficial).

## Instalación
1. En UI Homebridge: Plugins → Search → "homebridge-cecotec-conga" → Install.
   - O manual: `npm install homebridge-cecotec-conga`.

2. Reinicia Homebridge.

## Configuración
En UI Homebridge → Plugins → Cecotec Conga → Settings:

```json
{
  "platform": "CecotecConga",
  "name": "Conga X100",
  "token": "tu-token-jwt-aquí",
  "model": "X100",
  "pollingInterval": 15
}
```

### Obtener token (una vez):
Ejecuta `node get-token.js` (incluido):
```
npm install axios
node get-token.js
```
Introduce email/contraseña de app Cecotec → copia token.

## Uso
- App Casa: + → Añadir accesorio → Escanea QR de UI.
- Asigna habitaciones en app Casa.
- Siri/HomePod: Comandos en español.
- Watch/CarPlay: Automático tras pairing.

## Dependencias
- `axios`: Para API Cecotec.
- `homebridge`: Core.
- TypeScript: Compilación (dev).

## Soporte
Issues en GitHub. Compatible QNAP/Container Station.

## Licencia
MIT. Autores: TuNombre (con Grok).