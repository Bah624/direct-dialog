import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import { Email } from 'zitejs/email';

export default createEndpoint({
  description: 'Create or update a campaign, notify collaborators on validation',
  inputSchema: z.object({
    id: z.string().optional(),
    nomCampagne: z.string(),
    clientId: z.string().optional(),
    dateDebut: z.string().nullable().optional(),
    dateFin: z.string().nullable().optional(),
    statut: z.string().optional(),
    budgetTotal: z.number().optional(),
    validationCreation: z.string().optional(),
    commercialResponsable: z.string().optional(),
    description: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string(), success: z.boolean(), emailsSent: z.number().optional() }),
  execute: async ({ input }) => {
    const { id, clientId, dateDebut, dateFin, ...rest } = input;
    const record: Record<string, unknown> = {
      ...rest,
      client: clientId ? [clientId] : undefined,
      ...(dateDebut != null ? { dateDebut } : {}),
      ...(dateFin != null ? { dateFin } : {}),
    };

    // Check if this is a validation change
    let wasValidated = false;
    if (id && input.statut === 'Validée') {
      const existing = await zite.campagnes.findOne({ id, fields: ['statut'] });
      if (existing && existing.statut !== 'Validée') {
        wasValidated = true;
      }
    }
    if (!id && input.statut === 'Validée') {
      wasValidated = true;
    }

    let resultId: string;
    if (id) {
      const res = await zite.campagnes.update({ id, record });
      resultId = res.id;
    } else {
      const res = await zite.campagnes.create({ record });
      resultId = res.id;
    }

    // Send notification emails if campaign was just validated
    let emailsSent = 0;
    if (wasValidated) {
      const { records: collabs } = await zite.collaborateurs.findAll({
        filters: { notificationsActives: true },
        limit: 200,
      });

      const activeEmails = collabs
        .map(c => c.email)
        .filter((e): e is string => !!e);

      if (activeEmails.length > 0) {
        let clientName = '—';
        if (clientId) {
          const client = await zite.clients.findOne({ id: clientId, fields: ['nomClient'] });
          clientName = client?.nomClient ?? '—';
        }

        const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
        const formattedBudget = input.budgetTotal != null ? input.budgetTotal.toLocaleString('fr-FR') : '—';

        const emailBody = `Nouvelle campagne validée !\n\nLa campagne ${input.nomCampagne} vient d'être validée et est maintenant active.\n\nDétails de la campagne :\n- Client : ${clientName}\n- Budget total : ${formattedBudget} GNF\n- Date de début : ${fmtDate(input.dateDebut)}\n- Date de fin : ${fmtDate(input.dateFin)}\n- Commercial responsable : ${input.commercialResponsable ?? '—'}\n- Description : ${input.description ?? '—'}`;

        for (const email of activeEmails) {
          try {
            await Email.send({
              to: email,
              subject: `Campagne validee : ${input.nomCampagne}`,
              body: [
                {
                  type: 'text',
                  content: emailBody,
                },
                {
                  type: 'button',
                  label: 'Voir dans DIRECT DIALOG',
                  href: `${process.env.ZITE_APP_URL}/campagnes`,
                },
              ],
              logo: {
                url: 'https://images.fillout.com/orgid-206890/flowpublicid-ip2kuase4w/widgetid-default/uTZEoYADK2fSdXCzkEoKXf/Capture-daeIcran-2026-07-21-aI-11.11.57.png',
                width: 200,
                height: 114,
              },
            });
            emailsSent++;
          } catch (err) {
            console.error('Email send failed for', email, err);
          }
        }
      }
    }

    return { id: resultId, success: true, emailsSent };
  },
});
