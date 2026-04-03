-- Add VRPTW time-window columns to route_stops
ALTER TABLE "route_stops" ADD COLUMN "time_window_start" TIMESTAMP(3);
ALTER TABLE "route_stops" ADD COLUMN "time_window_end" TIMESTAMP(3);
