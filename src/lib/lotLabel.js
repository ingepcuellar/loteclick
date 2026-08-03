/**
 * lotLabel.js — Helper para mostrar el nombre de un lote en toda la app.
 *
 * Un lote puede ser:
 *   - Simple:   "Lote 5"
 *   - Manzana:  "Lote 5 - Mz A"
 *   - Etapa:    "Lote 5 - Etapa 2"
 *
 * @example
 *   import { getLotLabel } from '../../lib/lotLabel';
 *   <span>{getLotLabel(lot, project)}</span>
 */

/**
 * Devuelve el label legible de un lote.
 *
 * @param {object} lot     - Objeto lot (debe tener number y opcionalmente manzana)
 * @param {object} project - Objeto project (opcional, para leer block_type)
 * @returns {string}
 */
export function getLotLabel(lot, project = null) {
    if (!lot) return '-';

    const num = lot.number ?? lot.lot_number ?? '';

    // Si el proyecto tiene estructura nueva de Etapas -> Manzanas
    if (project?.stages && project?.blocks && lot.block_id) {
        const block = project.blocks.find(b => b.id === lot.block_id);
        if (block) {
            const stage = project.stages.find(s => s.id === block.stage_id);
            const stageStr = stage ? `${stage.name} - ` : '';
            return `Lote ${num} - ${stageStr}${block.name}`;
        }
    }

    // Sin manzana → "Lote 5"
    const manzana = lot.manzana ?? null;
    if (!manzana) return `Lote ${num}`;

    // Determinar tipo: prefiere el del proyecto, luego el del lote, por defecto manzana
    const tipo = project?.block_type ?? lot.block_type ?? 'manzana';
    const tipoLabel = tipo === 'etapa' ? 'Etapa' : 'Mz';

    return `Lote ${num} - ${tipoLabel} ${manzana}`;
}

/**
 * Agrupa un array de lots por manzana.
 * Los lots sin manzana van en el grupo null.
 *
 * @param {object[]} lots
 * @returns {Map<string|null, object[]>}  Mapa de manzana → lotes
 */
export function groupLotsByManzana(lots) {
    const map = new Map();
    for (const lot of (lots ?? [])) {
        const key = lot.manzana ?? null;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(lot);
    }
    return map;
}

/**
 * Agrupa lots usando la nueva estructura: Map<StageID, Map<BlockID, object[]>>
 */
export function groupLotsByHierarchy(lots, blocks = [], stages = []) {
    const map = new Map(); // stage_id -> Map(block_id -> lots)
    
    // Si no hay stages/blocks, devuelve un mapa vacío
    if (!stages.length || !blocks.length) return map;

    // Inicializar el mapa
    for (const stage of stages) {
        const blockMap = new Map();
        for (const block of blocks.filter(b => b.stage_id === stage.id)) {
            blockMap.set(block.id, { block, lots: [] });
        }
        map.set(stage.id, { stage, blockMap });
    }

    // Llenar con lotes
    for (const lot of (lots ?? [])) {
        if (lot.block_id) {
            const block = blocks.find(b => b.id === lot.block_id);
            if (block && map.has(block.stage_id) && map.get(block.stage_id).blockMap.has(block.id)) {
                map.get(block.stage_id).blockMap.get(block.id).lots.push(lot);
            }
        }
    }

    return map;
}

/**
 * Devuelve el label del tipo de agrupación (para encabezados de sección).
 *
 * @param {string|null} blockType  - 'manzana' | 'etapa' | null
 * @returns {string}  "Manzana" | "Etapa" | "Sección"
 */
export function getBlockTypeLabel(blockType) {
    if (blockType === 'etapa') return 'Etapa';
    if (blockType === 'manzana') return 'Manzana';
    return 'Sección';
}
