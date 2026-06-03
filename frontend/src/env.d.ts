/// <reference types="vite/client" />

import type { TeamABridgeApi, TeamBBridgeApi, TeamCBridgeApi, TeamDBridgeApi } from './types'

declare global {
  interface Window {
    teamAApi?: TeamABridgeApi
    teamBApi?: TeamBBridgeApi
    teamCApi?: TeamCBridgeApi
    teamDApi?: TeamDBridgeApi
  }
}
