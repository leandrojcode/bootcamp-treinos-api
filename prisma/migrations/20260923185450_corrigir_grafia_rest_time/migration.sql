/*
  Warnings:

  - You are about to drop the column `restTimInSeconds` on the `WorkoutExercise` table. All the data in the column will be lost.
  - Added the required column `restTimeInSeconds` to the `WorkoutExercise` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WorkoutExercise" DROP COLUMN "restTimInSeconds",
ADD COLUMN     "restTimeInSeconds" INTEGER NOT NULL;
