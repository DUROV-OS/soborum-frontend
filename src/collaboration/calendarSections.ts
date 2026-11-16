export const calendarSections = [
  ["mine", "Мой календарь"],
  ["team", "Календари команды"],
  ["planner", "Планировщик встреч"],
  ["settings", "Настройки"],
] as const;
export function calendarSection(search: string) {
  const selected = new URLSearchParams(search).get("section");
  return calendarSections.find(([key]) => key === selected)?.[0] || "mine";
}
