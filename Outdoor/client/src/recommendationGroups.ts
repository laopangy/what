import type { Candidate } from "./journeyTypes";
export function groupRecommendations(candidates: Candidate[], maxKm: number | null) {
  const distanceMax = maxKm ?? Math.max(50,...candidates.map(candidate => candidate.outbound.km));
  const bandSize = distanceMax <= 100 ? 10 : Math.ceil(distanceMax / 100) * 10;
  return Array.from({length: Math.ceil(distanceMax / bandSize)}, (_,index) => {
    const low = index * bandSize, high = Math.min(distanceMax,(index+1)*bandSize);
    return {label: index === 0 ? high + " 公里内" : low + "–" + high + " 公里",
      items: candidates.filter(candidate => (index === 0 ? candidate.outbound.km >= 0 : candidate.outbound.km > low) && candidate.outbound.km <= high)};
  });
}
