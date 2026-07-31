export type RootStackParamList = {
  Tabs: undefined;
  GarageDetail: { id: string };
  Route: {
    garageId: string;
    name: string;
    latitude: number;
    longitude: number;
  };
};
