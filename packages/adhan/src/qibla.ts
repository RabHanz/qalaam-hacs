/**
 * Qibla bearing — great-circle direction from a coordinate to the Kaaba.
 * The Kaaba is at (21.4225, 39.8262). Bearing returned in degrees (0..360).
 */
import { Coordinates as AdhanCoordinates, Qibla } from 'adhan';

import type { Coordinates } from './types.js';

export const KAABA: Coordinates = { lat: 21.4225, lng: 39.8262 };

/** Returns the qibla compass bearing in degrees (0=N, 90=E, 180=S, 270=W). */
export function qiblaBearing(from: Coordinates): number {
  return Qibla(new AdhanCoordinates(from.lat, from.lng));
}
