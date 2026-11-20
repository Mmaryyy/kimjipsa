import { cva } from "class-variance-authority";

export const customColorButtonStyles = cva([
  "size-9 min-h-9 p-0 after:pointer-events-none before:absolute before:-inset-1",
  "peer-focus-visible:outline-2 peer-focus-visible:outline-primary peer-focus-visible:outline-offset-2",
]);
