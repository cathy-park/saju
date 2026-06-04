import type { ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import type { BirthInput } from "@/lib/sajuEngine";

const schema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  gender: z.enum(["남", "여"]),
  calendarType: z.enum(["solar", "lunar"]),
  year: z.coerce
    .number()
    .min(1900, "1900년 이후만 지원됩니다")
    .max(2050, "2050년 이전만 지원됩니다"),
  month: z.coerce.number().min(1, "1~12월").max(12, "1~12월"),
  day: z.coerce.number().min(1, "1~31일").max(31, "1~31일"),
  hour: z.union([
    z.coerce.number().min(0, "0~23시").max(23, "0~23시"),
    z.literal(""),
  ]),
  minute: z.union([
    z.coerce.number().min(0, "0~59분").max(59, "0~59분"),
    z.literal(""),
  ]),
  birthplace: z.string().optional(),
  timeUnknown: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface BirthFormProps {
  defaultValues?: Partial<BirthInput>;
  onSubmit: (values: BirthInput) => void;
  submitLabel?: string;
  isLoading?: boolean;
  renderExtra?: ReactNode;
}

export function BirthForm({
  defaultValues,
  onSubmit,
  submitLabel = "저장",
  isLoading,
  renderExtra,
}: BirthFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      gender: defaultValues?.gender ?? "남",
      calendarType: defaultValues?.calendarType ?? "solar",
      year: defaultValues?.year ?? new Date().getFullYear() - 30,
      month: defaultValues?.month ?? 1,
      day: defaultValues?.day ?? 1,
      hour: defaultValues?.hour ?? "",
      minute: defaultValues?.minute ?? "",
      birthplace: defaultValues?.birthplace ?? "",
      timeUnknown: defaultValues?.timeUnknown ?? false,
    },
  });

  const timeUnknown = form.watch("timeUnknown");

  function handleSubmit(data: FormValues) {
    onSubmit({
      name: data.name,
      gender: data.gender as "남" | "여",
      calendarType: data.calendarType as "solar" | "lunar",
      year: data.year,
      month: data.month,
      day: data.day,
      hour:
        data.timeUnknown
          ? undefined
          : data.hour === ""
          ? undefined
          : Number(data.hour),
      minute:
        data.timeUnknown
          ? undefined
          : data.minute === ""
          ? undefined
          : Number(data.minute),
      birthplace: data.birthplace,
      timeUnknown: data.timeUnknown,
    });
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
      {/* 이름 + 성별 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="name">이름</Label>
          <Input
            id="name"
            placeholder="이름 입력"
            {...form.register("name")}
            className="mt-1"
          />
          {form.formState.errors.name && (
            <p className="text-[13px] text-destructive mt-1">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="col-span-2 sm:col-span-1">
          <Label>성별</Label>
          <Controller
            name="gender"
            control={form.control}
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="남" id="gender-male" />
                  <Label htmlFor="gender-male" className="cursor-pointer">
                    남
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="여" id="gender-female" />
                  <Label htmlFor="gender-female" className="cursor-pointer">
                    여
                  </Label>
                </div>
              </RadioGroup>
            )}
          />
        </div>
      </div>

      {/* 양/음력 */}
      <div>
        <Label>양/음력</Label>
        <Controller
          name="calendarType"
          control={form.control}
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="solar" id="cal-solar" />
                <Label htmlFor="cal-solar" className="cursor-pointer">
                  양력
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="lunar" id="cal-lunar" />
                <Label htmlFor="cal-lunar" className="cursor-pointer">
                  음력
                </Label>
              </div>
            </RadioGroup>
          )}
        />
      </div>

      {/* 출생연도/월/일 */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="year">출생연도</Label>
          <Input
            id="year"
            type="number"
            placeholder="예: 1990"
            {...form.register("year")}
            className="mt-1"
          />
          {form.formState.errors.year && (
            <p className="text-[13px] text-destructive mt-1">
              {form.formState.errors.year.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="month">월</Label>
          <Input
            id="month"
            type="number"
            placeholder="1~12"
            min={1}
            max={12}
            {...form.register("month")}
            className="mt-1"
          />
          {form.formState.errors.month && (
            <p className="text-[13px] text-destructive mt-1">
              {form.formState.errors.month.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="day">일</Label>
          <Input
            id="day"
            type="number"
            placeholder="1~31"
            min={1}
            max={31}
            {...form.register("day")}
            className="mt-1"
          />
          {form.formState.errors.day && (
            <p className="text-[13px] text-destructive mt-1">
              {form.formState.errors.day.message}
            </p>
          )}
        </div>
      </div>

      {/* 출생시간 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Controller
            name="timeUnknown"
            control={form.control}
            render={({ field }) => (
              <Checkbox
                id="timeUnknown"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Label htmlFor="timeUnknown" className="cursor-pointer text-sm">
            출생시간 모름 (시주 미산출)
          </Label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="hour" className={timeUnknown ? "text-muted-foreground" : ""}>
              출생시 (0~23)
            </Label>
            <Input
              id="hour"
              type="number"
              placeholder="예: 14"
              min={0}
              max={23}
              disabled={timeUnknown}
              {...form.register("hour")}
              className="mt-1"
            />
            {form.formState.errors.hour && (
              <p className="text-[13px] text-destructive mt-1">
                {String(form.formState.errors.hour.message ?? "")}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="minute" className={timeUnknown ? "text-muted-foreground" : ""}>
              출생분 (0~59)
            </Label>
            <Input
              id="minute"
              type="number"
              placeholder="예: 30"
              min={0}
              max={59}
              disabled={timeUnknown}
              {...form.register("minute")}
              className="mt-1"
            />
            {form.formState.errors.minute && (
              <p className="text-[13px] text-destructive mt-1">
                {String(form.formState.errors.minute.message ?? "")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 출생지 */}
      <div>
        <Label htmlFor="birthplace">출생지 (선택)</Label>
        <Input
          id="birthplace"
          placeholder="예: 서울, 부산"
          {...form.register("birthplace")}
          className="mt-1"
        />
        <p className="text-[13px] text-muted-foreground mt-1">
          출생지 입력 시 진태양시 보정에 활용됩니다
        </p>
      </div>

      {renderExtra}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "계산 중..." : submitLabel}
      </Button>
    </form>
  );
}
