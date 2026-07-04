import { describe, expect, it } from "vitest";
import type { DependencyResolver } from "../resources.js";
import { activationOrder } from "../resources.js";

/**
 * Unit tests for the pure `activationOrder` topo-DFS.
 *
 * The graph is supplied via a fake `DependencyResolver` (no filesystem), so
 * cycle / diamond / missing-node cases are tested directly. The on-disk
 * integration (repo-explorer -> dynamic-skills) is covered in run.test.ts.
 */

describe("activationOrder", () => {
	it("returns [root] when a bundle has no dependencies", async () => {
		const resolve: DependencyResolver = async () => [];
		expect(await activationOrder("a", resolve)).toEqual(["a"]);
	});

	it("resolves a linear chain deps-first (a -> b -> c)", async () => {
		const graph: Record<string, string[]> = { a: ["b"], b: ["c"], c: [] };
		const resolve: DependencyResolver = async (n) => graph[n] ?? [];
		expect(await activationOrder("a", resolve)).toEqual(["c", "b", "a"]);
	});

	it("resolves a single direct dependency deps-first (a -> b)", async () => {
		const graph: Record<string, string[]> = { a: ["b"], b: [] };
		const resolve: DependencyResolver = async (n) => graph[n] ?? [];
		expect(await activationOrder("a", resolve)).toEqual(["b", "a"]);
	});

	it("deduplicates a diamond: d appears once, before b and c, a last", async () => {
		//   a
		//  / \
		// b   c
		//  \ /
		//   d
		const graph: Record<string, string[]> = {
			a: ["b", "c"],
			b: ["d"],
			c: ["d"],
			d: [],
		};
		const resolve: DependencyResolver = async (n) => graph[n] ?? [];
		const order = await activationOrder("a", resolve);

		// d must come before both b and c; a must be last.
		expect(order).toContain("a");
		expect(order[order.length - 1]).toBe("a");
		expect(order.indexOf("d")).toBeLessThan(order.indexOf("b"));
		expect(order.indexOf("d")).toBeLessThan(order.indexOf("c"));
		// Exactly 4 entries (no duplicate d).
		expect(order).toHaveLength(4);
		// d emitted once.
		expect(order.filter((n) => n === "d")).toHaveLength(1);
	});

	it("orders multiple dependencies deps-first (a -> b, a -> c, both deps of each resolved)", async () => {
		const graph: Record<string, string[]> = { a: ["b", "c"], b: [], c: [] };
		const resolve: DependencyResolver = async (n) => graph[n] ?? [];
		const order = await activationOrder("a", resolve);
		expect(order[order.length - 1]).toBe("a");
		expect(order).toHaveLength(3);
	});

	it("throws on a self-cycle (a -> a)", async () => {
		const graph: Record<string, string[]> = { a: ["a"] };
		const resolve: DependencyResolver = async (n) => graph[n] ?? [];
		await expect(activationOrder("a", resolve)).rejects.toThrow(
			"Circular bundle dependency: a -> a",
		);
	});

	it("throws on a two-node cycle (a -> b -> a)", async () => {
		const graph: Record<string, string[]> = { a: ["b"], b: ["a"] };
		const resolve: DependencyResolver = async (n) => graph[n] ?? [];
		await expect(activationOrder("a", resolve)).rejects.toThrow(
			"Circular bundle dependency: a -> b -> a",
		);
	});

	it("throws on a longer cycle (a -> b -> c -> a)", async () => {
		const graph: Record<string, string[]> = {
			a: ["b"],
			b: ["c"],
			c: ["a"],
		};
		const resolve: DependencyResolver = async (n) => graph[n] ?? [];
		await expect(activationOrder("a", resolve)).rejects.toThrow(
			"Circular bundle dependency: a -> b -> c -> a",
		);
	});

	it("propagates a missing-dependency error from the resolver", async () => {
		const resolve: DependencyResolver = async (n) => {
			if (n === "a") return ["ghost"];
			throw new Error(`Bundle "${n}" not found.`);
		};
		await expect(activationOrder("a", resolve)).rejects.toThrow('Bundle "ghost" not found.');
	});

	it("supports an async resolver", async () => {
		const graph: Record<string, string[]> = { a: ["b"], b: [] };
		const resolve: DependencyResolver = async (n) => {
			// Simulate async manifest loading.
			await Promise.resolve();
			return graph[n] ?? [];
		};
		expect(await activationOrder("a", resolve)).toEqual(["b", "a"]);
	});
});
