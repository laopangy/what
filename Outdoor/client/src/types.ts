export type TransportMode = "driving" | "rail" | "cycling";
export type Intensity = "relaxed" | "moderate" | "challenging";

export interface OutdoorSettings { homeAddress: string }

export interface TripIntent {
  query: string;
  origin: string;
  destination: string;
  dayLabel: string;
  startTime: string;
  endTime: string;
  maxOneWayMinutes: number;
  transportModes: TransportMode[];
  intensity: Intensity;
}

export interface PlacePhoto { url: string; alt: string; source: string }

export interface ItineraryStop {
  id: string;
  order: number;
  type: "departure" | "parking" | "station" | "activity" | "meal" | "rest" | "return";
  title: string;
  subtitle: string;
  arrivalAt: string;
  departureAt: string;
  stayMinutes: number;
  travelMinutesFromPrevious: number;
  distanceKmFromPrevious: number;
  mapX: number;
  mapY: number;
  photo?: PlacePhoto;
  locked: boolean;
}

export interface Itinerary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  intent: TripIntent;
  transportMode: TransportMode;
  totalDistanceKm: number;
  totalTravelMinutes: number;
  estimatedCost: number;
  dataQuality: "estimated" | "live";
  stops: ItineraryStop[];
  photos: PlacePhoto[];
  warnings: string[];
  saved: boolean;
}
