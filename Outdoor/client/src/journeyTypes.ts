export type TravelMode = "driving" | "cycling" | "transit" | "rail";
export type Activity = "hiking" | "cycling" | "touring" | "leisure";
export interface Place {
  id: string; name: string; address: string; location: [number, number];
  citycode: string; adcode: string; photos: { url: string; title: string }[];
}
export interface TripDraft {
  origin: Place | null; startDate: string; endDate: string; startTime: string; endTime: string;
  maxMinutes: number | null; maxKm: number | null; people: number; mode: TravelMode;
  travelers?: { adults: number; seniors: number; children: number; women: number };
  rideTotalKm?: number | null; rideShape?: "return" | "loop"; rideVia?: Place | null;
  activity: Activity; activityMinutes: number; activityKm: number;
  destination: Place | null; dailyPlaces: Place[]; activityEnd: Place | null;
  lodging: "recommend" | "booked" | "later"; hotel: Place | null;
  rooms: number; hotelBudget: number; hotelPreference: string;
}
export interface RouteLeg {
  from: Place; to: Place; mode: TravelMode | "walking";
  minutes: number; km: number; paths: [number, number][][];
  instructions: string[]; queriedAt: string; source: "amap"; warning?: string;
}
export interface TripEvent {
  id: string; day: string; title: string; start: string; end: string;
  place: Place; kind: "departure" | "activity" | "meal" | "hotel" | "return";
  note: string; leg?: RouteLeg;
}
export interface Journey {
  version: 2; id: string; title: string; draft: TripDraft; events: TripEvent[];
  warnings: string[]; createdAt: string; saved: boolean;
}
export interface MapStatus { jsReady: boolean; serviceReady: boolean; ready: boolean }
export interface Candidate { place: Place; outbound: RouteLeg; returnRoute: RouteLeg }
