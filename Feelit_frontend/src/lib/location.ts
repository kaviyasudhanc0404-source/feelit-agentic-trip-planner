/** Ask the browser for the user's position (shows the permission prompt the first time). */
export function locate(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Location isn't available on this device."));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lon: coords.longitude }),
      () => reject(new Error("Please allow location access to find places near you.")),
      { timeout: 12_000, maximumAge: 10 * 60_000 },
    );
  });
}
