import { useEffect, useRef } from 'react';
import L from 'leaflet';
export function TrackingMap({ deliveryLocation, driverLocation, route, pickupLocation, }) {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markerRef = useRef({});
    useEffect(() => {
        if (!mapContainer.current)
            return;
        // Initialize map
        if (!map.current) {
            map.current = L.map(mapContainer.current).setView([40, -95], 4);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(map.current);
        }
        // Add pickup marker
        if (!markerRef.current.pickup) {
            const pickupIcon = L.divIcon({
                html: `<div style="
          width: 32px;
          height: 32px;
          background-color: #008060;
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        ">📍</div>`,
                iconSize: [32, 32],
                className: 'pickup-marker',
            });
            markerRef.current.pickup = L.marker([pickupLocation.latitude, pickupLocation.longitude], { icon: pickupIcon })
                .addTo(map.current)
                .bindPopup('Pickup Location');
        }
        // Add delivery marker
        if (!markerRef.current.delivery) {
            const deliveryIcon = L.divIcon({
                html: `<div style="
          width: 32px;
          height: 32px;
          background-color: #005bd3;
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        ">📦</div>`,
                iconSize: [32, 32],
                className: 'delivery-marker',
            });
            markerRef.current.delivery = L.marker([deliveryLocation.latitude, deliveryLocation.longitude], { icon: deliveryIcon })
                .addTo(map.current)
                .bindPopup('Delivery Location');
        }
        // Add/update driver marker
        if (driverLocation) {
            const driverIcon = L.divIcon({
                html: `<div style="
          width: 36px;
          height: 36px;
          background-color: #005bd3;
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          animation: pulse 2s infinite;
        ">🚗</div>
        <style>
          @keyframes pulse {
            0%, 100% { box-shadow: 0 2px 8px rgba(0, 91, 211, 0.2); }
            50% { box-shadow: 0 2px 16px rgba(0, 91, 211, 0.4); }
          }
        </style>`,
                iconSize: [36, 36],
                className: 'driver-marker',
            });
            if (markerRef.current.driver) {
                markerRef.current.driver.setLatLng([
                    driverLocation.latitude,
                    driverLocation.longitude,
                ]);
            }
            else {
                markerRef.current.driver = L.marker([driverLocation.latitude, driverLocation.longitude], { icon: driverIcon })
                    .addTo(map.current)
                    .bindPopup('Driver Location');
            }
        }
        // Add/update route polyline
        if (route.length > 0) {
            const routeCoordinates = route.map((loc) => [
                loc.latitude,
                loc.longitude,
            ]);
            if (markerRef.current.route) {
                markerRef.current.route.setLatLngs(routeCoordinates);
            }
            else {
                markerRef.current.route = L.polyline(routeCoordinates, {
                    color: '#005bd3',
                    weight: 3,
                    opacity: 0.7,
                    dashArray: '5, 5',
                }).addTo(map.current);
            }
        }
        // Fit bounds to show all markers
        if (map.current) {
            const group = new L.FeatureGroup([
                markerRef.current.pickup,
                markerRef.current.delivery,
                markerRef.current.driver,
            ].filter(Boolean));
            if (group.getLayers().length > 0) {
                map.current.fitBounds(group.getBounds(), { padding: [50, 50] });
            }
        }
    }, [deliveryLocation, driverLocation, route, pickupLocation]);
    return (<div ref={mapContainer} style={{
            width: '100%',
            height: '100%',
            minHeight: '400px',
        }}/>);
}
//# sourceMappingURL=TrackingMap.js.map