# NK_Terminal

**NK_Terminal** es una extensión para navegadores basados en Chromium (Chrome, Opera, Edge) que reemplaza la página de nueva pestaña con un dashboard estilo terminal.

![NK_Terminal](logo.svg)

## Características

- **Interfaz tipo terminal** — Una nueva pestaña con estética de línea de comandos.
- **Clima** — Muestra el clima actual mediante geolocalización por IP (wttr.in). También puedes establecer una ubicación manualmente.
- **Información del sistema** — Uso de memoria, CPU, almacenamiento, núcleos, navegador, red e idioma.
- **Enlaces rápidos** — Barra de accesos directos personalizables con soporte para arrastrar y soltar.
- **Múltiples temas** — Dark, Green, Amber, Light y Matrix.
- **Fuentes** — Courier, Fira Code, JetBrains Mono y System UI.
- **Mensaje de saludo** — Saludo personalizable según la hora del día.
- **Historial de comandos** — Navegación con flechas arriba/abajo.

## Comandos

| Comando | Descripción |
|---|---|
| `help` / `?` | Muestra la ayuda |
| `clear` / `cls` | Limpia la pantalla |
| `weather` | Muestra información detallada del clima |
| `location <nombre>` | Busca y establece una ubicación |
| `location <lat, lon>` | Establece coordenadas manualmente |
| `time` | Muestra la hora actual |
| `date` | Muestra la fecha actual |
| `sysinfo` | Información detallada del sistema |
| `link list` | Lista los enlaces rápidos |
| `link add <label> <url>` | Añade un enlace rápido |
| `link remove <idx>` | Elimina un enlace por índice |
| `link open <idx>` | Abre un enlace por índice |
| `link move <from> <to>` | Reordena los enlaces |
| `search <query>` | Busca en Google o abre una URL |

## Enlaces rápidos

Los enlaces rápidos aparecen en la parte inferior de la pantalla. Puedes:

- **Hacer clic** en un enlace para abrirlo.
- **Arrastrar y soltar** para reordenarlos.
- **Escribir la etiqueta** directamente en el terminal para abrir el enlace.
- Gestionarlos mediante el comando `link`.

Enlaces por defecto: YouTube, GitHub, Gmail, Claude, Gemini, ChatGPT, Drive y Google Docs.

## Personalización

Haz clic en el icono de engranaje (⚙) en la esquina superior derecha para abrir el panel de configuración, donde puedes cambiar:

- **Tema** — Dark, Green, Amber, Light, Matrix.
- **Fuente** — Courier, Fira Code, JetBrains Mono, System UI.
- **Tamaño de fuente** — 14px, 16px, 18px, 20px.
- **Saludo** — Mensaje personalizado.
- **Secciones** — Mostrar u ocultar clima e información del sistema.
- **Formato de hora** — 12h o 24h.

## Instalación

1. Descarga o clona este repositorio.
2. Abre `chrome://extensions` (o `opera://extensions`, `edge://extensions`).
3. Activa el **Modo desarrollador**.
4. Haz clic en **Cargar extensión sin empaquetar**.
5. Selecciona la carpeta del proyecto.

## Permisos

| Permiso | Motivo |
|---|---|
| `storage` | Guardar enlaces rápidos, configuración y caché de clima |
| `tabs` / `webNavigation` | Redirigir la nueva pestaña al terminal |
| `system.memory` / `system.cpu` / `system.storage` | Mostrar información del sistema |
| Hosts (`wttr.in`, `ip-api.com`, `ipapi.co`, `ipinfo.io`) | Obtener clima y geolocalización |

## Privacidad

NK_Terminal **no recopila ni transmite datos personales**. Toda la información se almacena localmente en `chrome.storage.local`. Las únicas peticiones externas son para obtener el clima (wttr.in) y geolocalización por IP (ip-api.com, ipapi.co, ipinfo.io).

Consulta [PRIVACY.md](PRIVACY.md) para más detalles.

## Desarrollo

```
NK_Terminal/
├── manifest.json     # Configuración de la extensión (MV3)
├── background.js     # Service worker (redirects, message relay)
├── terminal.html     # Página principal (nueva pestaña)
├── terminal.js       # Lógica del terminal y comandos
├── logo.png          # Icono PNG
├── logo.svg          # Icono SVG
└── PRIVACY.md        # Política de privacidad
```

## Autor

**NK**
