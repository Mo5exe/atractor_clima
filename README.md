# Atractor — Editor de Efectos Visuales v2

Editor de efectos visuales en tiempo real para proyectar en una pared.
La cámara detecta la mano y **todos los efectos convergen hacia ella**. Cada vez
que la mano toca, **surge una palabra**, se vuelve translúcida y sale volando.

Basado en [AppEfectos](https://github.com/Mo5exe/AppEfectos) (v1).

## Cómo usarlo (Windows)

1. Instalá [Node.js](https://nodejs.org) (versión LTS), si no lo tenés.
2. Hacé **doble clic en `run.bat`**.
   - La primera vez instala lo necesario y baja el modelo de detección de manos.
   - Inicia `node server.js` y abre el panel en una pestaña nueva de Google Chrome.
3. En el panel apretá **"Abrir salida con cámara ↗"** y permití el uso de la cámara.
   Llevá esa ventana al proyector (doble clic en la salida = pantalla completa).
   En la salida, la tecla **C** muestra u oculta una vista chica de la cámara.

Para bajar una versión nueva: doble clic en **`actualizar.bat`** (no borra tus presets).

## Qué tiene

**Efectos (capas)**: Partículas · Árbol Fractal · Flow Field (campo de vectores) ·
Fuego · Agua · **Palabras**.

- Cada capa tiene sus propios sliders, punto de origen (arrastrable), rotación de 45°,
  activar/desactivar, subir/bajar y eliminar.
- Cada capa tiene **"Atracción a la mano"** (0 = la ignora, 1 = máximo).

**Atractor (mano)**
- Partículas y fuego viajan hacia la mano · las líneas del flow field se curvan hacia
  ella · las ramas del árbol se doblan hacia la mano · el agua sube hacia la mano.
- Fuerza y radio de acción globales. Hasta 2 manos.
- Punto de la mano: palma o punta del índice. Opción de espejar la cámara.

**Palabras**
- Al tocar surge una palabra, se queda un momento, se vuelve translúcida y difuminada,
  y sale volando hacia un lado al azar. Si la mano sigue ahí, aparece otra (por defecto
  medio segundo después). Todo eso se ajusta con sliders.
- Fuentes de palabras (se elige en el panel):
  - **Mis palabras**: una lista propia, editable.
  - **Lo más leído en Wikipedia** (ayer).
  - **Titulares de diarios**: las palabras más repetidas en los titulares del día.
  - **Búsquedas en Google** (Google Trends).
  - **Trending de X** (trends24.in).
- País para las fuentes de internet. Se actualizan cada 3 minutos. Sin internet se usa
  la lista propia.

**Presets**: guardá la escena completa (capas y ajustes) con un nombre, y cargala con
un clic desde la barra lateral. Se guardan en `data/presets.json`.

## Probar sin cámara

En la ventana de salida, **mantené el clic y mové el mouse**: funciona como la mano.

## Cámara: panel o salida

El navegador pausa la cámara de una ventana tapada. Por eso lo recomendado es
**"Abrir salida con cámara"**: la salida (que siempre está a la vista) detecta la mano.
La cámara del panel sirve para probar y encuadrar, con dos pantallas.

## Estructura

```
server.js              servidor (Express + Socket.IO): estado, presets, trends
word-sources.js        fuentes de palabras (lista, Wikipedia, diarios, Google, X)
trending-scraper.js    lee trends24.in
run.bat                inicia todo (doble clic)
actualizar.bat         baja la última versión de GitHub
public/
  index.html           panel de control
  output.html          salida visual (sólo la imagen)
  style.css
  js/schemas.js        parámetros de cada efecto (compartido con el servidor)
  js/effects.js        los 6 efectos + atractor
  js/output.js         dibuja las capas en la salida
  js/control.js        panel de control
  js/hands.js          detección de manos (MediaPipe)
  js/control-camera.js cámara en el panel
  js/output-camera.js  cámara en la salida (?camara=1)
```

Pensado para cambiar después la cámara por un sensor LIDAR: sólo hay que mandar
`socket.emit("hands", { hands: [{ x, y }] })` con posiciones de 0 a 1.
