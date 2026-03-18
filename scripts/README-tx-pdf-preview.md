# Preview local del PDF principal de transacciones

## Ejecutar

1. Levanta un servidor estático en la raíz del repo:

```bash
python3 -m http.server 4173
```

2. Abre en el navegador:

```text
http://localhost:4173/scripts/tx-pdf-preview.html
```

## Qué genera

- Renderiza el PDF usando `tx-pdf-service.js` real (misma función `renderPdfToJsPdf`).
- Usa datos mock no productivos (fecha `18/03/2026`, identificador `FC-00001-26`, cliente demo y 4 conceptos).
- Permite visualizar y descargar el PDF de prueba.
