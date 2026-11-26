import { useSaveAmountFormat } from "@/features/account";
import { amountFormats, formatAmount, type AmountFormat } from "@/shared/lib";
import { GroupLabel, Select, Text } from "@/shared/ui";
import SettingsRow from "../settings-row";

interface Props {
  format: AmountFormat;
}

const AmountFormatSettings = ({ format }: Props) => {
  const save = useSaveAmountFormat();

  return (
    <section
      aria-labelledby="personal-settings-title"
      data-od-id="set-personal"
    >
      <GroupLabel id="personal-settings-title">내 설정</GroupLabel>
      <SettingsRow
        label={<label htmlFor="amount-format">금액 표시</label>}
        action={
          <Select
            id="amount-format"
            variant="row"
            className="w-42"
            value={save.isPending ? save.variables : format}
            disabled={save.isPending}
            onChange={(event) => {
              const selected = amountFormats.find(
                (option) => option === event.target.value,
              );
              if (selected && selected !== format) save.mutate(selected);
            }}
          >
            {amountFormats.map((option) => (
              <option key={option} value={option}>
                {formatAmount(1_200_000, option)}
              </option>
            ))}
          </Select>
        }
      />
      {save.error && (
        <Text as="p" role="alert" className="text-error-text">
          {save.error.message}
        </Text>
      )}
    </section>
  );
};

export default AmountFormatSettings;
