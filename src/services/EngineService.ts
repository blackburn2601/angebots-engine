import { prisma } from "@/lib/prisma";
import { runEngine } from "@/lib/engine";
import type { DomainConfig, PreisItem } from "@/types/domain";

export class EngineService {
  static async run(
    domainId: string,
    inputs: Record<string, unknown>,
    preisItems: PreisItem[] = []
  ) {
    const domain = await prisma.domain.findUniqueOrThrow({ where: { id: domainId } });
    const config: DomainConfig = JSON.parse(domain.config_json);
    return runEngine(config, inputs, preisItems);
  }
}
