/**
 * Authentic Ahmedabad Municipal Corporation (AMC) Fleet & Driver Metadata.
 * Contains registration numbers, vehicle models, and driver credentials
 * for all 4 municipal waste collection units.
 */

export const AMC_FLEET = [
  {
    id: 1,
    vehicleName: 'AMC Swachhata Vahini 01',
    plateNumber: 'GJ-01-CZ-4821',
    model: 'Tata Ultra 1918.T Hydraulic Compactor',
    capacityLiters: 5000,
    fuelType: 'CNG Green Fleet',
    zone: 'West Zone (Navrangpura)',
    depotName: 'Ashram Road Central Depot',
    depotCoords: [23.0345, 72.5564],
    color: '#2563eb',
    driver: {
      name: 'Hitarth Karia',
      empId: 'AMC-DRV-104',
      phone: 'Contact via AMC Dispatch',
      experience: '8 Years',
      rating: '4.9 ★',
      shift: 'Morning Shift (06:00 - 14:00)',
      licenseType: 'Commercial Heavy (HMV)',
    },
  },
  {
    id: 2,
    vehicleName: 'AMC Swachhata Vahini 02',
    plateNumber: 'GJ-01-EW-8392',
    model: 'Ashok Leyland Ecomet 1215 Star Heavy Compactor',
    capacityLiters: 5000,
    fuelType: 'BS-VI Clean Diesel',
    zone: 'North West Zone (Bodakdev & Vastrapur)',
    depotName: 'S.G. Highway Municipal Hub',
    depotCoords: [23.0475, 72.5364],
    color: '#8b5cf6',
    driver: {
      name: 'Krish Patel',
      empId: 'AMC-DRV-108',
      phone: 'Contact via AMC Dispatch',
      experience: '6 Years',
      rating: '4.8 ★',
      shift: 'Morning Shift (06:00 - 14:00)',
      licenseType: 'Commercial Heavy (HMV)',
    },
  },
  {
    id: 3,
    vehicleName: 'AMC Swachhata Vahini 03',
    plateNumber: 'GJ-01-TA-1049',
    model: 'BharatBenz 1617R Solid Waste Carrier',
    capacityLiters: 5000,
    fuelType: 'CNG Green Fleet',
    zone: 'Central Zone (Riverfront & Manek Chowk)',
    depotName: 'Kankaria South Hub',
    depotCoords: [23.0025, 72.5964],
    color: '#f59e0b',
    driver: {
      name: 'Sarthakk Anjariya',
      empId: 'AMC-DRV-112',
      phone: 'Contact via AMC Dispatch',
      experience: '10 Years',
      rating: '5.0 ★',
      shift: 'Morning Shift (06:00 - 14:00)',
      licenseType: 'Commercial Heavy (HMV)',
    },
  },
  {
    id: 4,
    vehicleName: 'AMC Swachhata Vahini 04',
    plateNumber: 'GJ-01-VK-5920',
    model: 'Eicher Pro 3015 Municipal Tipper Compactor',
    capacityLiters: 5000,
    fuelType: 'EV Clean Energy',
    zone: 'East Zone (Nikol & Bapunagar)',
    depotName: 'Nikol East Ring Hub',
    depotCoords: [23.0125, 72.6064],
    color: '#06b6d4',
    driver: {
      name: 'Kavin Jindal',
      empId: 'AMC-DRV-115',
      phone: 'Contact via AMC Dispatch',
      experience: '7 Years',
      rating: '4.9 ★',
      shift: 'Morning Shift (06:00 - 14:00)',
      licenseType: 'Commercial Heavy (HMV)',
    },
  },
];

export function getFleetVehicleMeta(idxOrName) {
  if (typeof idxOrName === 'number') {
    return AMC_FLEET[idxOrName % AMC_FLEET.length];
  }
  const found = AMC_FLEET.find(v => v.vehicleName === idxOrName || v.plateNumber === idxOrName);
  return found || AMC_FLEET[0];
}
