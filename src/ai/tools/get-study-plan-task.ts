'use server';
/**
 * @fileOverview A Genkit tool for fetching the user's study task for the current day.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { initializeFirebaseServer } from '@/firebase/server';

const StudyPlanTaskInputSchema = z.object({
  userId: z.string().describe("The unique ID of the user."),
  planId: z.string().optional().describe("The specific ID of the study plan to check. If not provided, the tool will check for any available plan."),
});

const StudyPlanTaskOutputSchema = z.object({
  status: z.enum(['task_found', 'no_task_today', 'no_plans_found', 'multiple_plans_found', 'plan_not_found', 'error']),
  message: z.string().describe("A human-readable message describing the result."),
  task: z.object({
    planName: z.string(),
    duration: z.string(),
    topic: z.string(),
    tasks: z.array(z.string()),
  }).optional().describe("The details of the study task for today."),
  availablePlans: z.array(z.object({ id: z.string(), name: z.string() })).optional().describe("A list of available study plans if multiple are found."),
});

export const getTodayStudyTask = ai.defineTool(
  {
    name: 'getTodayStudyTask',
    description: "Fetches the user's scheduled study task for the current day from their study plans in Firestore. It can also list available plans if more than one exists.",
    inputSchema: StudyPlanTaskInputSchema,
    outputSchema: StudyPlanTaskOutputSchema,
  },
  (async ({ userId, planId }: { userId: string; planId?: string }) => {
    try {
      const { firestore } = initializeFirebaseServer();
      const plansRef = collection(firestore, 'users', userId, 'studyPlans');
      const plansSnapshot = await getDocs(plansRef);

      if (plansSnapshot.empty) {
        return { status: 'no_plans_found', message: "The user has no study plans yet." };
      }

      const allPlans = plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      if (!planId) {
        if (allPlans.length > 1) {
          return {
            status: 'multiple_plans_found',
            message: "The user has multiple study plans. Ask them which one to proceed with.",
            availablePlans: allPlans.map(p => ({ id: p.id, name: p.name })),
          };
        }
        planId = allPlans[0].id;
      }

      const planRef = doc(firestore, 'users', userId, 'studyPlans', planId!);
      const planSnap = await getDoc(planRef);

      if (!planSnap.exists()) {
        return { status: 'plan_not_found', message: `Could not find a study plan with ID ${planId}. Please ask the user to select from their available plans.` };
      }

      const selectedPlan = planSnap.data() as any;

      if (!selectedPlan.startDate) {
        return { status: 'error', message: `The study plan '${selectedPlan.name}' is missing a start date.` };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize today's date

      const planStartDate = new Date(selectedPlan.startDate);
      planStartDate.setHours(0, 0, 0, 0); // Normalize start date

      const dayIndex = Math.floor((today.getTime() - planStartDate.getTime()) / (1000 * 3600 * 24));

      const dailyTasks = selectedPlan.plan || [];

      if (dayIndex >= 0 && dayIndex < dailyTasks.length) {
        const taskForToday = dailyTasks[dayIndex];
        return {
          status: 'task_found',
          message: `Found a task for today in the '${selectedPlan.name}' plan.`,
          task: {
            planName: selectedPlan.name,
            ...taskForToday
          }
        };
      } else {
        return { status: 'no_task_today', message: `There are no tasks scheduled for today in the '${selectedPlan.name}' plan.` };
      }

    } catch (e) {
      console.error("Error in getTodayStudyTask tool:", e);
      const error = e as Error;
      return { status: 'error', message: `An unexpected error occurred while fetching the study plan: ${error.message}` };
    }
  }) as any
);
