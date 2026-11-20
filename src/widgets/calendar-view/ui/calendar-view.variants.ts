import { cva } from "class-variance-authority";

export const calendarTodayButtonStyles = cva("min-h-11 min-w-11");

export const dayEventsStyles = cva("min-w-0");

export const dayEventListStyles = cva(
  "[&>[data-od-id=todo-row]+li:not([data-od-id=todo-row])]:mt-2",
);
