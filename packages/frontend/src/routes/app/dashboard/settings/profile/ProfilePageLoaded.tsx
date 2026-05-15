import { useEffect } from "react";
import type { Control } from "react-hook-form";
import { useForm, useWatch } from "react-hook-form";

import type { ProfileRow } from "@backend/types/database";
import { FloppyDiskIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRequiredAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { PageHeader } from "@/routes/app/PageShell";

import { Field, Section, Select } from "./form-controls";
import { LANGUAGES, TIMEZONES } from "./form-options";

const FORM_ID = "profile-form";

export function ProfilePageLoaded({ profile }: { profile: ProfileRow }) {
  const { user } = useRequiredAuth();
  const { register, handleSubmit, reset, control, formState } = useForm({
    defaultValues: {
      name: profile.name,
      language: profile.language,
      timezone: profile.timezone,
      about: profile.about,
    },
  });

  // Sync server-side changes into the form when the user has no unsaved
  // edits. If the form is dirty we leave it alone so an in-flight edit
  // isn't clobbered by a cross-tab save arriving mid-typing.
  useEffect(() => {
    if (formState.isDirty) return;
    reset({
      name: profile.name,
      language: profile.language,
      timezone: profile.timezone,
      about: profile.about,
    });
  }, [profile, formState.isDirty, reset]);

  const onSubmit = handleSubmit(async (values) => {
    await api.fetch("/api/user/profile", "PATCH", { body: values });
    reset(values);
  });

  const canSave = formState.isDirty && !formState.isSubmitting;

  return (
    <div className="flex h-full flex-col channel-coral">
      <PageHeader
        title="Profile"
        actions={<SaveButton canSave={canSave} submitting={formState.isSubmitting} />}
      />
      <form
        id={FORM_ID}
        onSubmit={(e) => { void onSubmit(e); }}
        className="min-h-0 flex-1 overflow-auto"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
          <Section title="IDENTITY" hint="How you appear in the app.">
            <Field label="NAME"><Input {...register("name")} /></Field>
            <Field label="USERNAME"><Input value={user.username} disabled className="text-text-3" /></Field>
          </Section>

          <Section title="PREFERENCES" hint="Used for dates, times, and default response language.">
            <Field label="LANGUAGE"><Select options={LANGUAGES} {...register("language")} /></Field>
            <Field label="TIMEZONE"><Select options={TIMEZONES} {...register("timezone")} /></Field>
          </Section>

          <Section
            title="ABOUT YOU"
            hint="Everything here is fed to the model as context. Describe your role, how you work, what matters, and how you want the agent to respond."
          >
            <Textarea
              {...register("about")}
              rows={10}
              placeholder="e.g. I'm a VC at Sequoia. Cover enterprise infra. Portfolio companies…"
              className="min-h-[220px] resize-y font-mono text-[13px] leading-relaxed"
            />
            <AboutCharCount control={control} />
          </Section>
        </div>
      </form>
    </div>
  );
}

type FormValues = {
  name: string;
  language: string;
  timezone: string;
  about: string;
};

function AboutCharCount({ control }: { control: Control<FormValues> }) {
  const about = useWatch({ control, name: "about" });
  return (
    <div
      className="text-right text-mint tabular-nums"
      style={{ fontSize: "0.625rem", letterSpacing: "0.06em", textTransform: "uppercase" }}
    >
      {about.length} CHARS
    </div>
  );
}

function SaveButton({ canSave, submitting }: { canSave: boolean; submitting: boolean }) {
  return (
    <Button
      type="submit"
      form={FORM_ID}
      variant="primary"
      size="sm"
      disabled={!canSave}
      loading={submitting}
    >
      <FloppyDiskIcon size={13} weight="bold" />
      SAVE
    </Button>
  );
}
