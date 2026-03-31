export function GenderSymbol({ gender }: { gender: string }) {
  if (gender === "여") return <span className="text-pink-500 font-bold">♀</span>;
  if (gender === "남") return <span className="text-blue-500 font-bold">♂</span>;
  return null;
}

export function NameWithGender({ name, gender }: { name: string; gender: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <GenderSymbol gender={gender} />
      {name}
    </span>
  );
}
