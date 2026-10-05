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

## Publicarlo en internet (Render)

1. Entrá a [render.com](https://render.com) y creá una cuenta con **"Sign in with GitHub"**.
2. Arriba a la derecha: **New → Blueprint**. Elegí el repositorio **atractor_clima**
   (si no aparece, tocá "Configure account" y dale permiso a Render para verlo).
3. Render lee `render.yaml` y te pide **PANEL_PASSWORD**: escribí la contraseña que vas a
   usar para entrar al panel. Apretá **Apply / Deploy**.
4. En unos minutos te da una dirección del tipo `https://atractor-clima.onrender.com`.
   - Panel: `https://atractor-clima.onrender.com` (pide la contraseña).
   - Salida para el proyector: `https://atractor-clima.onrender.com/output.html`
     (pública, pero no deja cambiar nada). Con cámara: `/output.html?camara=1`.
5. Cada vez que se sube un cambio a GitHub, Render lo publica solo.

**Plan gratis:** si nadie entra en 15 minutos, el servidor se duerme y la primera visita
tarda alrededor de un minuto en despertarlo. Además, **las imágenes, animaciones y presets
que subas se borran** cuando se reinicia o se actualiza. Usá **⬇ Descargar presets** para
guardarlos en tu compu y **⬆ Cargar presets** para volver a cargarlos, y guardá tus
archivos originales. Para que todo quede guardado hace falta un plan pago con disco (ver
los comentarios en `render.yaml` y la variable `DATA_DIR`).

En tu compu (con `run.bat`) no hay contraseña y todo se guarda como siempre.

La versión anterior quedó en la rama `version-3-antes-de-render`.

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

### Animaciones

Subí **GIF**, **PNG animado (APNG)**, **WebP animado** o videos **MP4 / MOV (H.264)** y
**WebM** (VP9; puede tener transparencia real). Se guardan en `data/animations` (hasta
500 MB por archivo).
- **Al tocar**: aparece donde toca la mano o el clic, se reproduce y sale volando.
- **Siempre visibles**: flotan alrededor del punto de origen.
- **Pantalla completa**: de fondo, ideal para loops de VJ (llenar o entera).
- **Mezcla**: normal, quitar el fondo negro (screen), sumar luz, quitar el fondo blanco.
- Con música: el volumen acelera la reproducción y el beat salta a otro momento (o vuelve
  al principio), y aparece una animación nueva.

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

En **"Titulares de diarios"** se elige el diario: argentinos, BBC, Deutsche Welle, The
Guardian, Al Jazeera, NPR, Spiegel, Le Monde… y tres de **arte**:
- **Arte digital y nuevos medios**: Creative Applications, Colossal, Designboom, Dezeen (inglés).
- **Arte contemporáneo**: Hyperallergic, ARTnews, Artnet, Colossal (inglés).
- **Arte y cultura**: Página/12, Clarín, Revista Ñ, El País (castellano).

En las fuentes de arte los nombres de artistas, lugares y obras quedan juntos
("Marta Minujín", "Refik Anadol", "Venice Biennale") y se sacan palabras obvias como "arte" o "muestra".

## Multijugador (con el celular)

- En el panel, tarjeta **📱 Multijugador**, hay un **código QR**. Cada persona lo escanea
  con su celular y entra a una página donde:
  - **su dedo** es una mano más en la proyección, con un color y un número propios;
  - puede escribir **su palabra**, que aparece donde toca (con filtro de malas palabras);
  - con **📷 Cámara** usa la cámara de adelante del celu: su mano mueve su "mano" en la
    proyección (sólo con https, o sea en Render).
- **Mostrar el QR en la salida**: pone el QR en un rincón de la proyección.
- Se puede apagar, limitar la cantidad de jugadores (hasta 30) o no dejar escribir palabras.
- En la compu (run.bat), los celulares tienen que estar en el **mismo wifi**. Si Windows
  pregunta por el firewall la primera vez, dale **Permitir** en redes privadas.
- En Render entran desde cualquier lugar con internet.

## Multitouch

- **Cámara**: detecta hasta 6 manos a la vez (por defecto 4, se elige en el panel, tarjeta
  ⚡ Atractor). Cada mano conserva su identidad aunque se mueva.
- **Pantalla o mesa táctil**: en la ventana de salida, cada dedo es una mano (el mouse
  también).
- Cada mano tiene sus propias palabras, imágenes y animaciones; el agua hace una ola por
  mano; el glitch "alrededor de la mano" aparece en todas. Partículas, flow field, rayas,
  árbol, fuego, nubes y lluvia van hacia la mano más cercana.

La versión anterior al multitouch quedó en la rama `version-2-antes-del-multitouch`.

## Probar sin cámara

En la salida, mantené el clic y mové el mouse: funciona como la mano.

## Estructura

```
server.js            servidor: estado, presets, clima, palabras, imágenes
auth.js              contraseña del panel (variable PANEL_PASSWORD)
render.yaml          configuración para publicar en Render
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
