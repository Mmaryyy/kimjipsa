import Link from "next/link";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageLayout from ".";
import PageHeader from "../page-header";

describe("P10.6.1 PageLayout 페이지 템플릿", () => {
  it.each([
    ["wide", "lg:max-w-280"],
    ["narrow", "lg:max-w-130"],
  ] as const)("%s 폭과 머리·본문을 렌더링해요", (width, maxWidth) => {
    const { container } = render(
      <PageLayout width={width} odId="sample-main" header={{ title: "견본" }}>
        <p>본문</p>
      </PageLayout>,
    );
    expect(container.firstChild).toHaveClass(maxWidth);
    if (width === "narrow") expect(container.firstChild).toHaveClass("mx-auto");
    expect(container.firstChild).toHaveAttribute("data-od-id", "sample-main");
    expect(
      screen.getByRole("heading", { level: 1, name: "견본" }),
    ).toBeVisible();
    expect(screen.getByText("본문")).toBeVisible();
  });

  it("하위 화면 navigation과 actions를 머리에 유지해요", () => {
    render(
      <PageLayout
        width="narrow"
        header={{
          title: "목록 관리",
          navigation: <Link href="/settings">설정</Link>,
          actions: <button>추가</button>,
          odId: "lists",
        }}
      />,
    );
    const heading = screen.getByRole("heading", { name: "목록 관리" });
    expect(heading.closest("header")).toContainElement(
      screen.getByRole("link", { name: "설정" }),
    );
    expect(heading.closest("header")).toContainElement(
      screen.getByRole("button", { name: "추가" }),
    );
    expect(heading).toHaveAttribute("data-od-id", "lists-title");
  });

  it("머리 slot과 본문을 렌더링해요", () => {
    render(
      <PageLayout width="wide" header={<PageHeader title="견본 머리" />}>
        본문
      </PageLayout>,
    );
    expect(screen.getByRole("heading", { name: "견본 머리" })).toBeVisible();
    expect(screen.getByText("본문")).toBeVisible();
  });
});
