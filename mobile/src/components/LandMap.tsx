import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';

const MapWebView = WebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<WebView> }>;
import { colors } from '@/lib/theme';

export type MapPin = { id: string; latitude: number; longitude: number; label: string };
export type Coordinates = { latitude: number; longitude: number };

type Props = {
  pins?: MapPin[];
  center?: Coordinates;
  zoom?: number;
  selectable?: boolean;
  selected?: Coordinates | null;
  onSelect?: (coordinates: Coordinates) => void;
  onPinPress?: (id: string) => void;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
};

const BENGALURU: Coordinates = { latitude: 12.9716, longitude: 77.5946 };

function buildHtml(initial: { center: Coordinates; zoom: number; interactive: boolean }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #e8eee9; }
  .pin { background: ${colors.primary}; color: #fff; font: 600 12px -apple-system, Roboto, sans-serif;
         padding: 4px 8px; border-radius: 14px; white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,.35);
         transform: translate(-50%, -100%); display: inline-block; border: 2px solid #fff; }
  .pin:after { content: ''; position: absolute; left: 50%; bottom: -7px; margin-left: -5px;
               border: 5px solid transparent; border-top-color: ${colors.primary}; }
  .chosen { width: 22px; height: 22px; border-radius: 50%; background: ${colors.danger}; border: 3px solid #fff;
            box-shadow: 0 1px 6px rgba(0,0,0,.4); transform: translate(-50%, -50%); }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var send = function (message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); };
  var map = L.map('map', { zoomControl: ${initial.interactive}, dragging: ${initial.interactive},
    scrollWheelZoom: ${initial.interactive}, doubleClickZoom: ${initial.interactive}, touchZoom: ${initial.interactive},
    attributionControl: true })
    .setView([${initial.center.latitude}, ${initial.center.longitude}], ${initial.zoom});
  var streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  var satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'
  });
  if (${initial.interactive}) L.control.layers({ 'Map': streets, 'Satellite': satellite }, null, { position: 'topright' }).addTo(map);
  var pinLayer = L.layerGroup().addTo(map);
  var chosen = null;
  var selectable = false;
  map.on('click', function (event) {
    if (!selectable) return;
    send({ type: 'select', latitude: event.latlng.lat, longitude: event.latlng.lng });
  });
  window.__update = function (state) {
    selectable = !!state.selectable;
    pinLayer.clearLayers();
    var bounds = [];
    (state.pins || []).forEach(function (pin) {
      var label = document.createElement('div');
      label.className = 'pin';
      label.textContent = pin.label;
      var icon = L.divIcon({ className: '', html: label, iconSize: null });
      var marker = L.marker([pin.latitude, pin.longitude], { icon: icon }).addTo(pinLayer);
      marker.on('click', function () { send({ type: 'pin', id: pin.id }); });
      bounds.push([pin.latitude, pin.longitude]);
    });
    if (chosen) { map.removeLayer(chosen); chosen = null; }
    if (state.selected) {
      chosen = L.marker([state.selected.latitude, state.selected.longitude], {
        icon: L.divIcon({ className: '', html: '<div class="chosen"></div>', iconSize: null })
      }).addTo(map);
    }
    if (state.recenter) {
      if (state.selected) map.setView([state.selected.latitude, state.selected.longitude], Math.max(map.getZoom(), 15));
      else if (bounds.length > 1 && state.fit) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      else if (bounds.length === 1) map.setView(bounds[0], Math.max(map.getZoom(), 14));
    }
  };
  send({ type: 'ready' });
</script>
</body>
</html>`;
}

export function LandMap({
  pins = [],
  center,
  zoom = 12,
  selectable = false,
  selected = null,
  onSelect,
  onPinPress,
  interactive = true,
  style,
}: Props) {
  const webview = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const fittedOnce = useRef(false);
  const [initialView] = useState(() => ({ center: center ?? selected ?? pins[0] ?? BENGALURU, zoom, interactive }));
  const html = useMemo(() => buildHtml(initialView), [initialView]);

  useEffect(() => {
    if (!ready) return;
    const fit = !fittedOnce.current && pins.length > 0 && !center;
    if (pins.length > 0) fittedOnce.current = true;
    const state = { pins, selectable, selected, recenter: true, fit };
    webview.current?.injectJavaScript(`window.__update(${JSON.stringify(state)}); true;`);
  }, [ready, pins, selectable, selected, center]);

  const handleMessage = (event: WebViewMessageEvent) => {
    const message = JSON.parse(event.nativeEvent.data) as
      | { type: 'ready' }
      | { type: 'select'; latitude: number; longitude: number }
      | { type: 'pin'; id: string };
    if (message.type === 'ready') setReady(true);
    if (message.type === 'select') onSelect?.({ latitude: message.latitude, longitude: message.longitude });
    if (message.type === 'pin') onPinPress?.(message.id);
  };

  return (
    <View style={[styles.container, style]}>
      <MapWebView
        ref={webview}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://landconnect.local/' }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        nestedScrollEnabled
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: '#e8eee9' },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
