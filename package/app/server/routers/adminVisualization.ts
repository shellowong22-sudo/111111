import { adminProcedure, router } from '../_core/trpc';
import { getAdminVisualizationDossier } from '../adminVisualizationDb';

export const adminVisualizationRouter = router({
  getDossier: adminProcedure.query(() => getAdminVisualizationDossier()),
});
