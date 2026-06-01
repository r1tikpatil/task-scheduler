import { useEffect, useRef } from "react";
import { SSE_EVENTS } from "../constants/enums";

const STREAM_URL = `${import.meta.env.VITE_API_URL ?? ""}/api/tasks/stream`;

export function useTaskStream(onEvent) {
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const source = new EventSource(STREAM_URL);

    const handleEvent = (event) => {
      try {
        const data = JSON.parse(event.data);
        handlerRef.current(data, event.type);
      } catch {
        // ignore malformed events
      }
    };

    SSE_EVENTS.forEach((eventName) => {
      source.addEventListener(eventName, handleEvent);
    });

    source.onerror = () => {
      // EventSource reconnects automatically
    };

    return () => source.close();
  }, []);
}
