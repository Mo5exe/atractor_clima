# Atractor Clima

Editor de efectos visuales en tiempo real para proyectar en una pared, **vinculado al clima**.
La cámara detecta la mano y todos los efectos convergen hacia ella. Al mismo tiempo, el
clima real de una ciudad (o uno que armás a mano) mueve todo: el viento empuja, la lluvia
cae, la temperatura tiñe los colores, la humedad nubla la escena y la hora cambia el cielo.

Basado en [atractor](https://github.com/Mo5exe/atractor), que a su vez parte de
[AppEfectos](https://github.com/Mo5exe/AppEfectos).

## Cómo usarlo (Windows)

1. Instalá [Node.js](https://nodejs.org) (versión LTS), si no lo tenés.
2. Doble clic en **`run.bat`**. La primera vez instala lo necesario y baja el modelo de
   detección de manos. Después inicia `node server.js` y abre el panel en Chrome.
3. Apretá **"Abrir salida con cámara ↗"** y permití la cámara. Doble clic en la salida =
   pantalla completa. Tecla **C** = ver la cámara.

Para bajar una versión nueva: **`actualizar.bat`** (no borra presets ni imágenes).

## El clima

- **Clima real** de Open-Meteo (gratis, sin registro), se actualiza cada 10 minutos.
  La ciudad se cambia desde el panel ("cambiar ciudad"). Por defecto: Buenos Aires.
- **Manual (probar)**: sliders de temperatura, humedad, lluvia, nubes, viento, dirección y
  luz del día, más climas de ejemplo (soleado, lluvia, tormenta, viento, frío, calor
  húmedo, niebla, noche).
- **Color según la temperatura**: frío → azules, calor → naranjas.
- **Niebla** según humedad y nubes.
- **Color de fondo** a elección, y opción de teñirlo según la hora (noche, amanecer, día).
- Cada capa tiene **"Influencia del clima"** (0 = la ignora).

| Clima | Qué hace |
| --- | --- |
| Viento | empuja partículas, píxeles, rayas, nubes, lluvia y palabras; orienta el flow field; inclina el fuego; hamaca el árbol; agita el agua |
| Lluvia | cantidad de gotas, sube el nivel del agua, achica el fuego |
| Temperatura | tiñe los colores; con frío el fuego se vuelve azul |
| Nubes / humedad | cantidad de nubes, niebla, palabras más difusas |
| Hora del día | color del cielo, nubes más oscuras de noche |

## Música (audio reactivo)

Tarjeta **🎵 Música** en el panel (viene apagada). Fuentes: micrófono / entrada de audio
(placa, interfaz, consola del DJ) o **sonido de la compu** (Chrome: elegir "Toda la
pantalla" y tildar "Compartir audio del sistema"). El audio se escucha en la **ventana de
salida**: la primera vez hay que apretar ahí "🎵 Clic para activar el audio".

- **Beat**: golpe de partículas y píxeles, salta el glitch, las rayas cambian de color,
  aparece una palabra o una imagen.
- **Graves**: las rayas engordan, el agua y el fuego pulsan, el árbol se sacude.
- **Agudos**: brillo, más ruido en el glitch, los píxeles titilan.
- **Volumen**: todo se mueve más rápido e intenso.

Medidores en vivo (graves, medios, agudos, volumen), indicador de beat y BPM. Cada capa
tiene **"Reacción a la música"** (0 = la ignora). Sensibilidad y detección de beats
ajustables.

La versión anterior al audio quedó guardada en la rama `version-1-antes-del-audio`.

## Capas

Partículas · Árbol Fractal · Flow Field · Fuego · Agua (banda espejada o hasta el borde) ·
**Palabras** · **Lluvia** (líneas diagonales) · **Nubes** · **Píxeles** (de un color, de
todos los colores, tonos o según la temperatura) · **Rayas verticales** · **Rayas
horizontales** · **Imágenes** (PNG con transparencia) · **Glitch**.

Todas tienen sliders propios, punto de origen, rotación, activar/desactivar, subir/bajar,
"Atracción a la mano" e "Influencia del clima".

### Imágenes

Subí PNG con fondo transparente (también JPG, GIF, WebP) desde la tarjeta de la capa
(botón o arrastrando). Se guardan en `data/images`.
- **Al tocar**: aparece una imagen donde toca la mano o el clic, se queda, se vuelve
  translúcida y sale volando.
- **Siempre visibles**: flotan alrededor del punto de origen; la mano las atrae y el
  viento las hamaca.

### Glitch

Un filtro que distorsiona lo que dibujan las capas que están arriba en la lista (ponela
última para que afecte a todo). Variantes: cortes, separación RGB, bloques, líneas de TV,
ruido, inversión, o todas mezcladas. Zona: toda la pantalla, una parte (centrada en el
punto de origen) o alrededor de la mano; en las dos últimas la zona tiene ramitas
ortogonales que cambian todo el tiempo. Cuándo: por ráfagas, siempre, o al tocar. El
viento fuerte y la tormenta lo intensifican.

### Palabras

Fuente **"Palabras del clima"** (por defecto), que mezcla:
- **Estado del clima en vivo**: "llovizna", "ráfagas de 45 km/h", "humedad 87%",
  "viento del sudeste", "sensación térmica 12°"…
- **Frases populares**, según el clima: "¡qué humedad!", "se largó", "día de tortas
  fritas", "hace un frío que pela", "se viene el agua"…
- **Tus palabras para cada clima** (una línea por clima: `lluvia: charco, paraguas`).
- **Voces de la gente** (opcional): fragmentos cortos de posteos públicos en castellano de
  Mastodon que hablan del clima, con filtro de malas palabras.

También están las otras fuentes: lista propia, Wikipedia, titulares de diarios, Google, X.

## Probar sin cámara

En la salida, mantené el clic y mové el mouse: funciona como la mano.

## Estructura

```
server.js            servidor: estado, presets, clima, palabras, imágenes
weather.js           clima real (Open-Meteo), modo manual, buscador de ciudad
climate-words.js     palabras del clima (estado, frases, tus palabras, Mastodon)
word-sources.js      otras fuentes de palabras
run.bat              inicia todo (doble clic) · actualizar.bat: baja la última versión
public/js/effects.js los 12 efectos + atractor + clima
public/js/output.js  salida: clima suavizado, cielo, niebla, música
public/js/audio.js   análisis de audio (graves, medios, agudos, volumen, beat, BPM)
public/js/control.js / control-weather.js   panel de control
```

Para cambiar la cámara por un sensor LIDAR: mandar
`socket.emit("hands", { hands: [{ x, y }] })` con posiciones de 0 a 1.
