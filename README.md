# REBEL · Ángel Edition

REBEL is a browser-based rehearsal studio by Thaguan Studio. It brings timing practice, drum patterns, songwriting and demo recording into one interface. The music tools run in the browser. The FlyYA text coach uses a server-side endpoint.

[Open the deployed rehearsal studio](https://bold-rain-cc1a.thaguanstudio.workers.dev/)

## Architecture

| Component | Responsibility |
| --- | --- |
| `index.html` | Rehearsal interface, Web Audio tools, microphone controls and coach client |
| `manifest.webmanifest` and `sw.js` | App metadata and service worker |
| `worker.js` | Validates `POST /api/coach`, forwards text to OpenAI and serves static assets |
| `wrangler.jsonc` | Cloudflare Worker entry point and bindings |

The metronome and drum sequencer run locally so their timing does not depend on network requests. The coach sends text and a bounded conversation history through the Worker. The OpenAI key is supplied to the server as `OPENAI_API_KEY`. Live audio feedback would require a separate audio pipeline.

## Run locally

Clone this repository. From the project directory, run `python3 -m http.server 8000` and open `http://localhost:8000` to try the rehearsal interface. Start the metronome or sequencer after interacting with the page. Grant microphone access to try recording.

To exercise the coach route, run `npx wrangler dev`. For a development credential, set `OPENAI_API_KEY` in a local, untracked `.dev.vars` file. Configure the key as a secret in the deployed Worker. A valid coach request with a configured key can be billable.

## Verify the API

`GET /api/coach` should return HTTP 405. `GET /api/unknown` should return HTTP 404. With a development key configured, malformed JSON and missing, blank or oversized messages should return HTTP 400 before calling OpenAI. Upstream failures return HTTP 502.

## Deployment options

Cloudflare Workers runs the current server entry point. A Spaceship migration would require a Node.js entry point that preserves `POST /api/coach` and a server-side `OPENAI_API_KEY`. Serve only browser assets from the public directory. Verify metronome playback, microphone permissions and the coach route on a staging HTTPS URL before switching the public domain.
