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
- Al enviar un mensaje, si hubo cambios en la selección desde el último envío en ese chat, se añade automáticamente al final del mensaje (oculto por debajo, sin que se vea al escribir):
  - Los prompts activos, en un único párrafo.
  - Si desmarcaste alguno, un aviso de revocación para que el modelo deje de aplicarlo.
- Si no cambias nada respecto al envío anterior, no se repite el prompt.
- Funciona en cualquier punto de la conversación, no solo al principio.

## Editar los prompts disponibles

Abre el script y modifica el array `PROMPTS` al principio del archivo:

```js
const PROMPTS = [
    { id: 'concision', name: 'concision', text: 'Be extremely concise.' },
    // añade más objetos { id, name, text } aquí
];
```

- `id`: identificador único interno.
- `name`: lo que se muestra en el desplegable.
- `text`: la instrucción que se envía al modelo.