# DeepPrompt

Script de Tampermonkey que añade un icono junto al botón "Share" de DeepSeek Chat para marcar qué instrucciones (system prompts) quieres aplicar a la conversación.

## Instalación

1. Instala la extensión [Tampermonkey](https://www.tampermonkey.net/) en tu navegador.
2. Abre el panel de Tampermonkey → **Crear nuevo script**.
3. Borra el contenido de ejemplo y pega el contenido de `deepseek-system-prompt.user.js`.
4. Guarda (Ctrl+S).
5. Entra o recarga [chat.deepseek.com](https://chat.deepseek.com).

## Uso

- Verás un icono (⚙️) junto al botón "Share". Pasa el cursor por encima (o haz clic) para desplegar la lista de prompts disponibles.
- Marca los que quieras aplicar. Si no marcas ninguno, no se añade nada a tus mensajes.
- Al enviar un mensaje, si hubo cambios en la selección desde el último envío en ese chat, se añade automáticamente al final del mensaje:
  - Los prompts activos, en un único párrafo.
  - Si desmarcaste alguno, un aviso de revocación para que el modelo deje de aplicarlo.
- El texto añadido queda oculto por debajo del scroll (no salta a mostrarlo al insertarlo).
- Si no cambias nada respecto al envío anterior, no se repite el prompt.
- Funciona en cualquier punto de la conversación, no solo al principio.
- La selección de prompts marcados persiste entre conversaciones (no hace falta volver a marcarlos cada vez). Lo que sí se reinicia al abrir un chat nuevo es el registro de "qué ya se envió en este chat": por eso, si tenías algo marcado de antes, se inyecta de nuevo en el primer mensaje del chat nuevo.

## Editar los prompts disponibles

Abre el script y modifica el array `PROMPTS` al principio del archivo:

```js
const PROMPTS = [
    { id: 'concision', name: 'Sé conciso', text: 'Responde de forma extremadamente concisa...' },
    // añade más objetos { id, name, text } aquí
];
```

- `id`: identificador único interno.
- `name`: lo que se muestra en el desplegable.
- `text`: la instrucción que se envía al modelo.