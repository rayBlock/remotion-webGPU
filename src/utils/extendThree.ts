import * as THREE from "three/webgpu";
import { extend, type ThreeToJSXElements } from "@react-three/fiber";

// Register three/webgpu classes with R3F — import as side-effect
declare module "@react-three/fiber" {
    interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}
extend(THREE as any);
