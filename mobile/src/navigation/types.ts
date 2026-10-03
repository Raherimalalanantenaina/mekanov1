export type RootStackParamList = {
  Tabs: undefined;
  /** `review` : ouvre directement le formulaire d'avis (prérempli avec `reviewName`) */
  GarageDetail: { id: string; review?: boolean; reviewName?: string };
  Route: {
    garageId: string;
    name: string;
    latitude: number;
    longitude: number;
  };
};
