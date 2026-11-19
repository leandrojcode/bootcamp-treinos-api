export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class WorkoutPlanNotActiveError extends Error {
  constructor(message = "O plano de treino informado nao esta ativo.") {
    super(message);
    this.name = "WorkoutPlanNotActiveError";
  }
}
