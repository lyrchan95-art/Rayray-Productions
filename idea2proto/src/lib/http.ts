import "server-only";
import { NextResponse } from "next/server";
import { HttpError } from "./auth";

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
      if ((e as { name?: string }).name === "ZodError") return NextResponse.json({ error: "Invalid input", issues: (e as { issues: unknown }).issues }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}
