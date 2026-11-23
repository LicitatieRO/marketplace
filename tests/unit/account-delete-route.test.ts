import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const deleteUser = vi.fn();
const rpc = vi.fn();
const enforceAuthHttpRateLimit = vi.fn();
const accountDeleteBlockReason = vi.fn();
const getViewer = vi.fn();

vi.mock("@/lib/server/auth-rate-limit", () => ({
  enforceAuthHttpRateLimit,
  AUTH_RATE_LIMIT_MESSAGE: "Too many attempts.",
}));

vi.mock("@/lib/server/account-delete-eligibility", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/server/account-delete-eligibility")
  >();
  return {
    ...actual,
    accountDeleteBlockReason,
  };
});

vi.mock("@/lib/server/auth", () => ({
  requireSignedInUser: vi.fn(async () => ({
    db: {
      auth: {
        signOut: vi.fn(async () => ({ error: null })),
      },
    },
    user: { id: "user-1", email: "member@example.test" },
  })),
  getViewer,
}));

vi.mock("@/lib/server/service-role", () => ({
  serviceRoleClient: vi.fn(() => ({
    auth: { admin: { deleteUser } },
    rpc,
  })),
}));

const baseEnv = { ...process.env };

afterEach(() => {
  process.env = { ...baseEnv };
  vi.clearAllMocks();
  enforceAuthHttpRateLimit.mockResolvedValue(null);
  accountDeleteBlockReason.mockResolvedValue(null);
  getViewer.mockResolvedValue({
    id: "user-1",
    email: "member@example.test",
    is_staff: false,
    aal: "aal1",
    display_name: "Member",
  });
  deleteUser.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ data: 0, error: null });
});

function deleteRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/account/delete", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/account/delete", () => {
  it("refuses delete when viewer cannot be loaded (fail closed)", async () => {
    getViewer.mockResolvedValue(null);
    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(
      deleteRequest({
        confirm: true,
        confirmation: "DELETE",
      }),
    );
    expect(response.status).toBe(403);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(accountDeleteBlockReason).not.toHaveBeenCalled();
  });

  it("does not call deleteUser for staff accounts", async () => {
    getViewer.mockResolvedValue({
      id: "user-1",
      email: "staff@example.test",
      is_staff: true,
      aal: "aal2",
      display_name: "Staff",
    });
    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(
      deleteRequest({
        confirm: true,
        confirmation: "DELETE",
      }),
    );
    expect(response.status).toBe(403);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("does not call deleteUser when retention blockers exist", async () => {
    accountDeleteBlockReason.mockResolvedValue("open_bids");
    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(
      deleteRequest({
        confirm: true,
        confirmation: "member@example.test",
      }),
    );
    expect(response.status).toBe(409);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("returns 409 for has_history with GDPR email guidance", async () => {
    accountDeleteBlockReason.mockResolvedValue("has_history");
    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(
      deleteRequest({
        confirm: true,
        confirmation: "DELETE",
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.error).toContain("can't be deleted automatically");
    expect(body.error).toContain("data-protection contact");
    expect(body.error).toContain("within one month");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("returns 404 when eligibility reports not_found", async () => {
    accountDeleteBlockReason.mockResolvedValue("not_found");
    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(
      deleteRequest({
        confirm: true,
        confirmation: "DELETE",
      }),
    );
    expect(response.status).toBe(404);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("does not call deleteUser when confirmation is invalid", async () => {
    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(
      deleteRequest({
        confirm: true,
        confirmation: "wrong",
      }),
    );
    expect(response.status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("calls deleteUser when allowed", async () => {
    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(
      deleteRequest({
        confirm: true,
        confirmation: "DELETE",
      }),
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("account_delete_release_invites", {
      p_user_id: "user-1",
    });
    expect(deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("returns 409 when deleteUser fails with a foreign-key block", async () => {
    deleteUser.mockResolvedValue({
      error: {
        code: "23503",
        message:
          'update or delete on table "users" violates foreign key constraint "bids_bidder_id_fkey"',
      },
    });
    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(
      deleteRequest({
        confirm: true,
        confirmation: "DELETE",
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.error).toContain("can't be deleted automatically");
    expect(body.error).not.toContain("foreign key");
    expect(body.error).not.toContain("bids_bidder_id_fkey");
  });

  it("returns masked 503 when release invites fails", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "release failed" },
    });
    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(
      deleteRequest({
        confirm: true,
        confirmation: "DELETE",
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.error).toBe(
      "The request could not be completed. Please try again.",
    );
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("redacts deleteUser failures that are not foreign-key blocks", async () => {
    deleteUser.mockResolvedValue({
      error: {
        code: "unexpected_failure",
        message: "internal admin configuration token leak",
      },
    });
    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(
      deleteRequest({
        confirm: true,
        confirmation: "DELETE",
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.error).toBe(
      "The request could not be completed. Please try again.",
    );
    expect(JSON.stringify(body)).not.toContain("token leak");
  });
});
