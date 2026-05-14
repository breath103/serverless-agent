import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRefreshAuth } from "@/contexts/AuthContext";
import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

type FormValues = { username: string; password: string; name: string };

export function EmailPasswordForm({
  mode,
  onSuccess,
}: {
  mode: Mode;
  onSuccess: () => void;
}) {
  const { register, handleSubmit, setError, formState } = useForm<FormValues>({
    defaultValues: { username: "", password: "", name: "" },
    mode: "onChange",
  });
  const refresh = useRefreshAuth();

  const onSubmit = handleSubmit(async ({ username, password, name }) => {
    const result = mode === "sign-in"
      ? await authClient.signIn.username({ username, password })
      : await authClient.signUp.username({ username, password, name });
    if (result.error) {
      setError("root", { message: result.error.message });
      return;
    }
    await refresh();
    onSuccess();
  });

  return (
    <form
      onSubmit={(e) => { void onSubmit(e); }}
      className="flex flex-col gap-4"
    >
      <Field label="USERNAME">
        <Input
          type="text"
          placeholder="Username"
          autoComplete="username"
          required
          {...register("username", { required: true, minLength: 3 })}
        />
      </Field>

      {mode === "sign-up" && (
        <Field label="NAME">
          <Input
            type="text"
            placeholder="Name"
            autoComplete="name"
            required
            {...register("name", { required: true })}
          />
        </Field>
      )}

      <Field label="PASSPHRASE">
        <Input
          type="password"
          placeholder="Password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          required
          {...register("password", { required: true, minLength: 5 })}
        />
      </Field>

      {formState.errors.root && (
        <div className="border border-red px-3 py-2 text-xs text-red">
          ! {formState.errors.root.message}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="mt-2 w-full"
        loading={formState.isSubmitting}
        disabled={!formState.isValid}
      >
        {mode === "sign-in" ? "AUTHENTICATE" : "REGISTER"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="hud-label">{label}</span>
      {children}
    </label>
  );
}
