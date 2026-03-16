let activeBuildingId: string | null = null;

const BUILDING_EVENT = "active-building-changed";

export const getActiveBuildingId = (): string | null => activeBuildingId;

export const setActiveBuildingId = (buildingId: string | null) => {
    activeBuildingId = buildingId;
    window.dispatchEvent(new CustomEvent(BUILDING_EVENT, { detail: buildingId }));
};

export const onActiveBuildingChange = (callback: (buildingId: string | null) => void) => {
    const handler = (event: Event) => {
        const customEvent = event as CustomEvent<string | null>;
        callback(customEvent.detail ?? null);
    };

    window.addEventListener(BUILDING_EVENT, handler);
    return () => window.removeEventListener(BUILDING_EVENT, handler);
};
