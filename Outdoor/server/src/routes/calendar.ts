import { Router } from "express";
import { z } from "zod";
import { appleCredentialsSchema, calendarSelectionSchema, calendarService } from "../icloudCalendar.js";

export const calendarRouter = Router();
calendarRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
calendarRouter.get("/calendar/status", async (_req, res, next) => { try { res.json(await calendarService.status()); } catch (error) { next(error); } });
calendarRouter.post("/calendar/connect", async (req, res, next) => { try { res.json(await calendarService.connect(appleCredentialsSchema.parse(req.body))); } catch (error) { next(error); } });
calendarRouter.post("/calendar/refresh", async (_req, res, next) => { try { res.json(await calendarService.refresh()); } catch (error) { next(error); } });
calendarRouter.put("/calendar/selection", async (req, res, next) => { try { res.json(await calendarService.select(calendarSelectionSchema.parse(req.body))); } catch (error) { next(error); } });
calendarRouter.delete("/calendar/connection", async (_req, res, next) => { try { res.json(await calendarService.disconnect()); } catch (error) { next(error); } });
calendarRouter.post("/journeys/:id/calendar", async (req, res, next) => { try { res.json(await calendarService.sync(z.string().uuid().parse(req.params.id))); } catch (error) { next(error); } });
