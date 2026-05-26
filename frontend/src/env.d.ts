/// <reference types="vite/client" />

import type { TeamABridgeApi } from './types'

declare global {
  interface Window {
    teamAApi?: TeamABridgeApi
  }
}
