/**
 * Ambient module declarations for packages used in the dashboard
 * but not listed as explicit dependencies.
 */

// Google Maps namespace
declare namespace google {
  namespace maps {
    class Map {
      constructor(el: HTMLElement, options?: MapOptions);
      setCenter(latLng: LatLng | LatLngLiteral): void;
      setZoom(zoom: number): void;
      getZoom(): number;
      panTo(latLng: LatLng | LatLngLiteral): void;
      fitBounds(bounds: LatLngBounds): void;
      addListener(
        event: string,
        handler: (...args: unknown[]) => void,
      ): MapsEventListener;
    }
    interface MapOptions {
      center?: LatLng | LatLngLiteral;
      zoom?: number;
      mapTypeId?: string;
      styles?: unknown[];
      [key: string]: unknown;
    }
    class Marker {
      constructor(options?: MarkerOptions);
      setPosition(latLng: LatLng | LatLngLiteral): void;
      setMap(map: Map | null): void;
      addListener(
        event: string,
        handler: (...args: unknown[]) => void,
      ): MapsEventListener;
      getPosition(): LatLng;
    }
    interface MarkerOptions {
      position?: LatLng | LatLngLiteral;
      map?: Map;
      title?: string;
      icon?: string | unknown;
      [key: string]: unknown;
    }
    class Polyline {
      constructor(options?: PolylineOptions);
      setMap(map: Map | null): void;
      getPath(): MVCArray<LatLng>;
    }
    interface PolylineOptions {
      path?: LatLng[] | LatLngLiteral[];
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      map?: Map;
      [key: string]: unknown;
    }
    class Polygon {
      constructor(options?: PolygonOptions);
      setMap(map: Map | null): void;
      getPath(): MVCArray<LatLng>;
      getPaths(): MVCArray<MVCArray<LatLng>>;
      setOptions(options: PolygonOptions): void;
      addListener(
        event: string,
        handler: (arg?: unknown) => void,
      ): MapsEventListener;
    }
    interface PolygonOptions {
      paths?: LatLng[] | LatLngLiteral[] | LatLng[][] | LatLngLiteral[][];
      strokeColor?: string;
      strokeWeight?: number;
      fillColor?: string;
      fillOpacity?: number;
      editable?: boolean;
      map?: Map;
      [key: string]: unknown;
    }
    class Rectangle {
      constructor(options?: RectangleOptions);
      setMap(map: Map | null): void;
      getBounds(): LatLngBounds;
      addListener(
        event: string,
        handler: (...args: unknown[]) => void,
      ): MapsEventListener;
    }
    interface RectangleOptions {
      bounds?:
        | LatLngBounds
        | { north: number; east: number; south: number; west: number };
      strokeColor?: string;
      strokeWeight?: number;
      fillColor?: string;
      fillOpacity?: number;
      editable?: boolean;
      map?: Map;
      [key: string]: unknown;
    }
    const ControlPosition: {
      TOP_LEFT: number;
      TOP_CENTER: number;
      TOP_RIGHT: number;
      LEFT_TOP: number;
      LEFT_CENTER: number;
      LEFT_BOTTOM: number;
      RIGHT_TOP: number;
      RIGHT_CENTER: number;
      RIGHT_BOTTOM: number;
      BOTTOM_LEFT: number;
      BOTTOM_CENTER: number;
      BOTTOM_RIGHT: number;
      [key: string]: number;
    };
    namespace geometry {
      namespace spherical {
        function computeDistanceBetween(
          from: LatLng | LatLngLiteral,
          to: LatLng | LatLngLiteral,
        ): number;
        function computeArea(path: LatLng[] | MVCArray<LatLng>): number;
        function computeHeading(from: LatLng, to: LatLng): number;
        function computeOffset(
          from: LatLng,
          distance: number,
          heading: number,
        ): LatLng;
      }
      namespace poly {
        function containsLocation(point: LatLng, polygon: Polygon): boolean;
        function isLocationOnEdge(
          point: LatLng,
          poly: Polygon | Polyline,
          tolerance?: number,
        ): boolean;
      }
      namespace encoding {
        function decodePath(encodedPath: string): LatLng[];
        function encodePath(path: LatLng[] | MVCArray<LatLng>): string;
      }
    }
    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }
    interface LatLngLiteral {
      lat: number;
      lng: number;
    }
    class LatLngBounds {
      constructor(sw?: LatLng | LatLngLiteral, ne?: LatLng | LatLngLiteral);
      extend(point: LatLng | LatLngLiteral): LatLngBounds;
      getCenter(): LatLng;
      getNorthEast(): LatLng;
      getSouthWest(): LatLng;
      contains(point: LatLng | LatLngLiteral): boolean;
      isEmpty(): boolean;
      toJSON(): { north: number; east: number; south: number; west: number };
    }
    interface MapsEventListener {
      remove(): void;
    }
    class MVCArray<T> {
      getArray(): T[];
      getAt(i: number): T;
      getLength(): number;
      push(elem: T): number;
      pop(): T;
      removeAt(i: number): T;
      insertAt(i: number, elem: T): void;
      forEach(callback: (elem: T, index: number) => void): void;
      clear(): void;
    }
    class visualization {
      static HeatmapLayer: {
        new (options?: {
          data?: unknown[];
          map?: Map;
          radius?: number;
          maxIntensity?: number;
          opacity?: number;
          gradient?: string[];
        }): {
          setMap(map: Map | null): void;
          setData(data: unknown[]): void;
        };
      };
    }
    const SymbolPath: {
      CIRCLE: number;
      FORWARD_CLOSED_ARROW: number;
      FORWARD_OPEN_ARROW: number;
      BACKWARD_CLOSED_ARROW: number;
      BACKWARD_OPEN_ARROW: number;
      [key: string]: number;
    };
    interface Icon {
      url?: string;
      path?: string | number;
      scale?: number;
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeWeight?: number;
      anchor?: Point;
      labelOrigin?: Point;
      size?: Size;
      origin?: Point;
      [key: string]: unknown;
    }
    class Point {
      constructor(x: number, y: number);
      x: number;
      y: number;
    }
    class Size {
      constructor(
        width: number,
        height: number,
        widthUnit?: string,
        heightUnit?: string,
      );
      width: number;
      height: number;
    }
    namespace event {
      function addListener(
        instance: unknown,
        eventName: string,
        handler: (arg?: unknown) => void,
      ): MapsEventListener;
      function removeListener(listener: MapsEventListener): void;
      function clearInstanceListeners(instance: unknown): void;
    }
    class Geocoder {
      geocode(
        request: { address?: string; location?: LatLng | LatLngLiteral },
        callback: (results: GeocoderResult[], status: string) => void,
      ): void;
    }
    interface GeocoderResult {
      formatted_address: string;
      geometry: { location: LatLng };
      [key: string]: unknown;
    }
    namespace drawing {
      class DrawingManager {
        constructor(options?: {
          drawingMode?: string | null;
          drawingControl?: boolean;
          drawingControlOptions?: unknown;
          map?: Map;
          polygonOptions?: unknown;
          rectangleOptions?: unknown;
          markerOptions?: unknown;
          circleOptions?: unknown;
          polylineOptions?: unknown;
          [key: string]: unknown;
        });
        setMap(map: Map | null): void;
        setDrawingMode(mode: string | null): void;
        addListener(
          event: string,
          handler: (arg?: unknown) => void,
        ): MapsEventListener;
      }
    }
    class DirectionsService {
      route(
        request: unknown,
        callback: (result: unknown, status: string) => void,
      ): void;
    }
    class DirectionsRenderer {
      constructor(options?: unknown);
      setMap(map: Map | null): void;
      setDirections(result: unknown): void;
    }
    class InfoWindow {
      constructor(options?: {
        content?: string;
        position?: LatLng | LatLngLiteral;
      });
      open(map?: Map, anchor?: Marker): void;
      close(): void;
    }
    namespace places {
      class Autocomplete {
        constructor(input: HTMLInputElement, options?: unknown);
        addListener(event: string, handler: () => void): MapsEventListener;
        getPlace(): PlaceResult;
      }
      class AutocompleteService {
        constructor();
        getPlacePredictions(request: {
          input: string;
          types?: string[];
          componentRestrictions?: unknown;
        }): Promise<{ predictions: AutocompletePrediction[] }>;
        getPlacePredictions(
          request: {
            input: string;
            types?: string[];
            componentRestrictions?: unknown;
          },
          callback: (
            predictions: AutocompletePrediction[] | null,
            status: string,
          ) => void,
        ): void;
      }
      class PlacesService {
        constructor(attrContainer: HTMLElement | Map);
        getDetails(
          request: { placeId: string; fields?: string[] },
          callback: (result: PlaceResult | null, status: string) => void,
        ): void;
        textSearch(
          request: {
            query: string;
            location?: LatLng | LatLngLiteral;
            radius?: number;
            type?: string;
            [key: string]: unknown;
          },
          callback: (results: PlaceResult[] | null, status: string) => void,
        ): void;
        nearbySearch(
          request: {
            location?: LatLng | LatLngLiteral;
            radius?: number;
            type?: string;
            keyword?: string;
            [key: string]: unknown;
          },
          callback: (results: PlaceResult[] | null, status: string) => void,
        ): void;
        findPlaceFromQuery(
          request: { query: string; fields: string[] },
          callback: (results: PlaceResult[] | null, status: string) => void,
        ): void;
      }
      interface PlaceResult {
        place_id?: string;
        name?: string;
        formatted_address?: string;
        formatted_phone_number?: string;
        international_phone_number?: string;
        adr_address?: string;
        website?: string;
        url?: string;
        utc_offset?: number;
        utc_offset_minutes?: number;
        geometry?: { location: LatLng; viewport?: LatLngBounds };
        address_components?: AddressComponent[];
        types?: string[];
        rating?: number;
        user_ratings_total?: number;
        price_level?: number;
        opening_hours?: {
          isOpen(): boolean;
          weekday_text?: string[];
        };
        photos?: Array<{
          getUrl(opts?: { maxWidth?: number; maxHeight?: number }): string;
        }>;
        vicinity?: string;
        plus_code?: { compound_code?: string; global_code?: string };
        [key: string]: unknown;
      }
      interface AddressComponent {
        long_name: string;
        short_name: string;
        types: string[];
      }
      interface AutocompletePrediction {
        description: string;
        place_id: string;
        structured_formatting: { main_text: string; secondary_text: string };
        types?: string[];
        terms?: Array<{ offset: number; value: string }>;
        matched_substrings?: Array<{ length: number; offset: number }>;
        distance_meters?: number;
      }
      const PlacesServiceStatus: {
        OK: string;
        ZERO_RESULTS: string;
        INVALID_REQUEST: string;
        OVER_QUERY_LIMIT: string;
        REQUEST_DENIED: string;
        UNKNOWN_ERROR: string;
      };
    }
  }
}

// Storybook module declarations
declare module "@storybook/react" {
  export interface Meta<T = unknown> {
    title?: string;
    component?: T;
    decorators?: unknown[];
    parameters?: Record<string, unknown>;
    argTypes?: Record<string, unknown>;
    args?: Record<string, unknown>;
    tags?: string[];
  }
  export type StoryObj<T = unknown> = {
    args?: Record<string, unknown>;
    render?: (args: Record<string, unknown>) => unknown;
    play?: (context: unknown) => Promise<void> | void;
    [key: string]: unknown;
  };
  export type Story = StoryObj;
}

// Mapbox GL namespace
declare namespace mapboxgl {
  interface MapMouseEvent {
    type: string;
    target: Map;
    originalEvent: MouseEvent;
    point: { x: number; y: number };
    lngLat: { lng: number; lat: number };
    features?: Array<{
      type: string;
      properties: Record<string, unknown>;
      geometry: unknown;
    }>;
    preventDefault(): void;
  }

  interface GeoJSONSource {
    setData(data: unknown): this;
    getClusterExpansionZoom(
      clusterId: number,
      callback: (err: Error | null, zoom: number) => void,
    ): this;
    getClusterChildren(
      clusterId: number,
      callback: (err: Error | null, features: unknown[]) => void,
    ): this;
    getClusterLeaves(
      clusterId: number,
      limit: number,
      offset: number,
      callback: (err: Error | null, features: unknown[]) => void,
    ): this;
  }

  class Map {
    constructor(options: {
      container: string | HTMLElement;
      style?: string;
      center?: [number, number];
      zoom?: number;
      pitch?: number;
      bearing?: number;
      [key: string]: unknown;
    });
    on(event: string, layer: string, handler: (e: MapMouseEvent) => void): this;
    on(event: string, handler: (...args: unknown[]) => void): this;
    off(event: string, handler: (...args: unknown[]) => void): this;
    remove(): void;
    addSource(id: string, source: unknown): this;
    addLayer(layer: unknown): this;
    removeLayer(id: string): this;
    removeSource(id: string): this;
    getSource(id: string): unknown;
    setLayoutProperty(layer: string, name: string, value: unknown): this;
    setPaintProperty(layer: string, name: string, value: unknown): this;
    fitBounds(
      bounds: LngLatBounds | [[number, number], [number, number]],
      options?: {
        padding?:
          | number
          | { top?: number; bottom?: number; left?: number; right?: number };
        duration?: number;
        [key: string]: unknown;
      },
    ): this;
    flyTo(options: {
      center?: [number, number];
      zoom?: number;
      duration?: number;
      speed?: number;
      curve?: number;
      bearing?: number;
      pitch?: number;
      [key: string]: unknown;
    }): this;
    easeTo(options: {
      center?: [number, number];
      zoom?: number;
      duration?: number;
      bearing?: number;
      pitch?: number;
      [key: string]: unknown;
    }): this;
    zoomTo(
      zoom: number,
      options?: { duration?: number; [key: string]: unknown },
    ): this;
    getCenter(): { lng: number; lat: number };
    getZoom(): number;
    getCanvas(): HTMLCanvasElement;
    setStyle(style: string, options?: unknown): this;
    addControl(control: unknown, position?: string): this;
    removeControl(control: unknown): this;
    queryRenderedFeatures(point: unknown, options?: unknown): unknown[];
    isStyleLoaded(): boolean;
    loaded(): boolean;
    getBounds(): LngLatBounds;
    setPitch(pitch: number): this;
    setBearing(bearing: number): this;
    resize(): this;
  }
  class Marker {
    constructor(options?: {
      color?: string;
      element?: HTMLElement;
      anchor?: string;
      offset?: [number, number];
    });
    setLngLat(lngLat: [number, number]): this;
    addTo(map: Map): this;
    remove(): void;
    getLngLat(): { lng: number; lat: number };
    setPopup(popup: Popup): this;
    getElement(): HTMLElement;
  }
  class Popup {
    constructor(options?: {
      offset?: number | [number, number];
      closeButton?: boolean;
      closeOnClick?: boolean;
      maxWidth?: string;
    });
    setLngLat(lngLat: [number, number]): this;
    setHTML(html: string): this;
    setText(text: string): this;
    addTo(map: Map): this;
    remove(): void;
    isOpen(): boolean;
  }
  class NavigationControl {
    constructor(options?: unknown);
  }
  class GeolocateControl {
    constructor(options?: unknown);
  }
  class ScaleControl {
    constructor(options?: unknown);
  }
  class FullscreenControl {
    constructor(options?: unknown);
  }
  interface LngLatBounds {
    extend(lngLat: [number, number] | { lng: number; lat: number }): this;
    getCenter(): { lng: number; lat: number };
    getNorthEast(): { lng: number; lat: number };
    getSouthWest(): { lng: number; lat: number };
    isEmpty(): boolean;
    toArray(): [[number, number], [number, number]];
  }
  const LngLatBounds: {
    new (
      sw?: [number, number] | null,
      ne?: [number, number] | null,
    ): LngLatBounds;
    (sw?: [number, number] | null, ne?: [number, number] | null): LngLatBounds;
  };
  function accessToken(token: string): void;
  let accessToken: string;
}

// SWR - data fetching library
declare module "swr" {
  export interface SWRConfiguration {
    fetcher?: (key: string) => Promise<unknown>;
    revalidateOnFocus?: boolean;
    revalidateOnReconnect?: boolean;
    dedupingInterval?: number;
    focusThrottleInterval?: number;
    [key: string]: unknown;
  }

  export function SWRConfig(props: {
    children: import("react").ReactNode;
    value?: SWRConfiguration;
  }): import("react").ReactElement;

  export default function useSWR<T = unknown>(
    key: string | null,
    fetcher?: (key: string) => Promise<T>,
    options?: SWRConfiguration,
  ): {
    data: T | undefined;
    error: Error | undefined;
    isLoading: boolean;
    isValidating: boolean;
    mutate: (
      data?: T | Promise<T> | ((current?: T) => T | Promise<T> | undefined),
      opts?: { revalidate?: boolean },
    ) => Promise<T | undefined>;
  };
}

// Zod - schema validation library (available via @witylogix/core which depends on it)
declare module "zod" {
  export * from "zod/lib/index";
  export const z: typeof import("zod/lib/index");
}

// Glob - file pattern matching
declare module "glob" {
  export function glob(
    pattern: string,
    options?: { cwd?: string },
  ): Promise<string[]>;
}

// Testing Library types (for test files)
declare module "@testing-library/react" {
  import type { ReactElement } from "react";

  export interface RenderResult {
    container: HTMLElement;
    baseElement: HTMLElement;
    debug: (
      baseElement?: HTMLElement | HTMLElement[],
      maxLength?: number,
    ) => void;
    unmount: () => void;
    rerender: (ui: ReactElement) => void;
    asFragment: () => DocumentFragment;
    getByRole: (role: string, options?: Record<string, unknown>) => HTMLElement;
    getByText: (
      text: string | RegExp,
      options?: Record<string, unknown>,
    ) => HTMLElement;
    getByLabelText: (
      text: string | RegExp,
      options?: Record<string, unknown>,
    ) => HTMLElement;
    getByPlaceholderText: (
      text: string | RegExp,
      options?: Record<string, unknown>,
    ) => HTMLElement;
    getByTestId: (
      testId: string,
      options?: Record<string, unknown>,
    ) => HTMLElement;
    getByDisplayValue: (
      value: string | RegExp,
      options?: Record<string, unknown>,
    ) => HTMLElement;
    getByTitle: (
      title: string | RegExp,
      options?: Record<string, unknown>,
    ) => HTMLElement;
    queryByText: (
      text: string | RegExp,
      options?: Record<string, unknown>,
    ) => HTMLElement | null;
    queryByRole: (
      role: string,
      options?: Record<string, unknown>,
    ) => HTMLElement | null;
    queryByLabelText: (text: string | RegExp) => HTMLElement | null;
    queryByTestId: (testId: string) => HTMLElement | null;
    findByText: (
      text: string | RegExp,
      options?: Record<string, unknown>,
    ) => Promise<HTMLElement>;
    findByRole: (
      role: string,
      options?: Record<string, unknown>,
    ) => Promise<HTMLElement>;
    getAllByRole: (
      role: string,
      options?: Record<string, unknown>,
    ) => HTMLElement[];
    getAllByText: (
      text: string | RegExp,
      options?: Record<string, unknown>,
    ) => HTMLElement[];
    getAllByLabelText: (text: string | RegExp) => HTMLElement[];
    getAllByTestId: (testId: string) => HTMLElement[];
  }

  export function render(
    ui: ReactElement,
    options?: Record<string, unknown>,
  ): RenderResult;
  export const screen: {
    getByRole: (role: string, options?: Record<string, unknown>) => HTMLElement;
    getByText: (
      text: string | RegExp,
      options?: Record<string, unknown>,
    ) => HTMLElement;
    getByLabelText: (
      text: string | RegExp,
      options?: Record<string, unknown>,
    ) => HTMLElement;
    getByPlaceholderText: (
      text: string | RegExp,
      options?: Record<string, unknown>,
    ) => HTMLElement;
    getByTestId: (testId: string) => HTMLElement;
    getByDisplayValue: (
      value: string | RegExp,
      options?: Record<string, unknown>,
    ) => HTMLElement;
    getByTitle: (
      title: string | RegExp,
      options?: Record<string, unknown>,
    ) => HTMLElement;
    getByAltText: (
      text: string | RegExp,
      options?: Record<string, unknown>,
    ) => HTMLElement;
    queryByText: (
      text: string | RegExp,
      options?: Record<string, unknown>,
    ) => HTMLElement | null;
    queryByRole: (
      role: string,
      options?: Record<string, unknown>,
    ) => HTMLElement | null;
    queryByLabelText: (text: string | RegExp) => HTMLElement | null;
    queryByPlaceholderText: (text: string | RegExp) => HTMLElement | null;
    queryByTestId: (testId: string) => HTMLElement | null;
    queryByDisplayValue: (value: string | RegExp) => HTMLElement | null;
    findByText: (
      text: string | RegExp,
      options?: Record<string, unknown>,
    ) => Promise<HTMLElement>;
    findByRole: (
      role: string,
      options?: Record<string, unknown>,
    ) => Promise<HTMLElement>;
    findByLabelText: (text: string | RegExp) => Promise<HTMLElement>;
    findByPlaceholderText: (text: string | RegExp) => Promise<HTMLElement>;
    getAllByRole: (
      role: string,
      options?: Record<string, unknown>,
    ) => HTMLElement[];
    getAllByText: (
      text: string | RegExp,
      options?: Record<string, unknown>,
    ) => HTMLElement[];
    getAllByLabelText: (text: string | RegExp) => HTMLElement[];
    getAllByTestId: (testId: string) => HTMLElement[];
    debug: () => void;
  };
  export const fireEvent: {
    (element: HTMLElement, event: Event): boolean;
    click: (element: HTMLElement, options?: Record<string, unknown>) => boolean;
    change: (
      element: HTMLElement,
      event?: { target?: { value?: string; checked?: boolean } },
    ) => boolean;
    submit: (element: HTMLElement) => boolean;
    focus: (element: HTMLElement) => boolean;
    blur: (element: HTMLElement) => boolean;
    keyDown: (
      element: HTMLElement,
      options?: {
        key?: string;
        keyCode?: number;
        code?: string;
        [key: string]: unknown;
      },
    ) => boolean;
    keyUp: (
      element: HTMLElement,
      options?: {
        key?: string;
        keyCode?: number;
        code?: string;
        [key: string]: unknown;
      },
    ) => boolean;
    keyPress: (
      element: HTMLElement,
      options?: { key?: string; keyCode?: number; [key: string]: unknown },
    ) => boolean;
    input: (
      element: HTMLElement,
      event?: { target?: { value?: string } },
    ) => boolean;
    mouseDown: (
      element: HTMLElement,
      options?: Record<string, unknown>,
    ) => boolean;
    mouseUp: (
      element: HTMLElement,
      options?: Record<string, unknown>,
    ) => boolean;
    mouseMove: (
      element: HTMLElement,
      options?: Record<string, unknown>,
    ) => boolean;
    mouseEnter: (
      element: HTMLElement,
      options?: Record<string, unknown>,
    ) => boolean;
    mouseLeave: (
      element: HTMLElement,
      options?: Record<string, unknown>,
    ) => boolean;
    dblClick: (
      element: HTMLElement,
      options?: Record<string, unknown>,
    ) => boolean;
    drop: (element: HTMLElement, options?: Record<string, unknown>) => boolean;
    dragOver: (
      element: HTMLElement,
      options?: Record<string, unknown>,
    ) => boolean;
    paste: (element: HTMLElement, options?: Record<string, unknown>) => boolean;
    scroll: (
      element: HTMLElement,
      options?: Record<string, unknown>,
    ) => boolean;
  };
  export function waitFor<T>(
    callback: () => T | Promise<T>,
    options?: {
      timeout?: number;
      interval?: number;
      onTimeout?: (error: Error) => Error;
    },
  ): Promise<T>;
  export function act(callback: () => void | Promise<void>): Promise<void>;
  export function cleanup(): void;
  export interface RenderHookResult<Result, Props> {
    rerender: (props?: Props) => void;
    result: { current: Result };
    unmount: () => void;
  }
  export function renderHook<Result, Props = unknown>(
    render: (initialProps: Props) => Result,
    options?: { initialProps?: Props; wrapper?: unknown },
  ): RenderHookResult<Result, Props>;
}

declare module "@testing-library/user-event" {
  export interface UserEvent {
    type: (
      element: HTMLElement,
      text: string,
      options?: Record<string, unknown>,
    ) => Promise<void>;
    click: (element: HTMLElement) => Promise<void>;
    clear: (element: HTMLElement) => Promise<void>;
    selectOptions: (
      element: HTMLElement,
      values: string | string[],
    ) => Promise<void>;
    keyboard: (text: string) => Promise<void>;
    tab: () => Promise<void>;
    setup: (options?: Record<string, unknown>) => UserEvent;
  }

  const userEvent: UserEvent & {
    setup: (options?: Record<string, unknown>) => UserEvent;
  };
  export default userEvent;
}
