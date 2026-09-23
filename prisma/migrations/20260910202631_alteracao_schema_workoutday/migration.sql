/*
  Warnings:

  - Added the required column `estimatedDurationSeconds` to the `WorkoutDay` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WorkoutDay" ADD COLUMN     "estimatedDurationSeconds" INTEGER NOT NULL;
