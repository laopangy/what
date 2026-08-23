import { Router } from "express";
import { getQQCharts, getQQLibrary, getQQLoginStatus, getQQPlaylistDetail } from "../services/qqMusic.js";

export const qqRouter = Router();

qqRouter.get("/home", async (_req, res, next) => {
  try {
    const account = getQQLoginStatus();
    const [charts, library] = await Promise.all([
      getQQCharts(12),
      account.loggedIn ? getQQLibrary() : Promise.resolve({ created: [], collected: [] }),
    ]);
    res.json({
      success: true,
      data: {
        account,
        library,
        charts,
      },
    });
  } catch (error) { next(error); }
});

qqRouter.get("/playlist/:id", async (req, res, next) => {
  try {
    res.json({ success: true, data: await getQQPlaylistDetail(req.params.id) });
  } catch (error) { next(error); }
});
