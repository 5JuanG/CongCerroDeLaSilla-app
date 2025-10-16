
import React, { useState, useEffect, useCallback } from 'react';
import { AsistenciaData, AttendanceRecord, MONTHS } from '../App';

interface AsistenciaFormProps {
    attendanceRecords: AttendanceRecord[];
    onSave: (year: number, month: string, data: AsistenciaData) => Promise<void>;
}

const AsistenciaForm: React.FC<AsistenciaFormProps> = ({ attendanceRecords, onSave }) => {
    const [mes, setMes] = useState('');
    const [ano, setAno] = useState<number | string>(new Date().getFullYear());
    const [attendance, setAttendance] = useState<AsistenciaData>({
        es_sem1: '', es_sem2: '', es_sem3: '', es_sem4: '', es_sem5: '',
        fs_sem1: '', fs_sem2: '', fs_sem3: '', fs_sem4: '', fs_sem5: '',
    });
    const [totals, setTotals] = useState({ es_total: '', es_promedio: '', fs_total: '', fs_promedio: '' });
    const [status, setStatus] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setAttendance(prev => ({ ...prev, [name]: value }));
    };
    
    const calculateTotals = useCallback(() => {
        const calculateRow = (prefix: 'es' | 'fs') => {
            let total = 0;
            let count = 0;
            for (let i = 1; i <= 5; i++) {
                const value = parseInt(attendance[`${prefix}_sem${i}` as keyof AsistenciaData], 10);
                if (!isNaN(value) && value > 0) {
                    total += value;
                    count++;
                }
            }
            const average = count > 0 ? (total / count).toFixed(2) : '';
            return { total: total > 0 ? total.toString() : '', average };
        };

        const es = calculateRow('es');
        const fs = calculateRow('fs');

        setTotals({
            es_total: es.total,
            es_promedio: es.average,
            fs_total: fs.total,
            fs_promedio: fs.average
        });
    }, [attendance]);
    
    useEffect(() => {
        calculateTotals();
    }, [calculateTotals]);

    const clearForm = useCallback(() => {
        setAttendance({
            es_sem1: '', es_sem2: '', es_sem3: '', es_sem4: '', es_sem5: '',
            fs_sem1: '', fs_sem2: '', fs_sem3: '', fs_sem4: '', fs_sem5: '',
        });
        setStatus('');
    }, []);

    const loadDataForMonth = useCallback(() => {
        if (ano.toString().length === 4 && mes) {
            const record = attendanceRecords.find(r => r.ano === Number(ano) && r.mes === mes);
            if (record) {
                const { id, ano: recordAno, mes: recordMes, ...attendanceData } = record;
                const initialData: AsistenciaData = {
                    es_sem1: '', es_sem2: '', es_sem3: '', es_sem4: '', es_sem5: '',
                    fs_sem1: '', fs_sem2: '', fs_sem3: '', fs_sem4: '', fs_sem5: '',
                };
                const populatedData = { ...initialData, ...attendanceData };
                setAttendance(populatedData);
                setStatus("Datos cargados. Puede editar y guardar los cambios.");
            } else {
                clearForm();
                setStatus("No hay datos para este mes. Puede ingresar un nuevo informe.");
            }
        } else {
            clearForm();
        }
    }, [ano, mes, attendanceRecords, clearForm]);
    
    useEffect(() => {
        loadDataForMonth();
    }, [loadDataForMonth]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mes || !ano) {
            setStatus("Por favor, seleccione un mes y un año.");
            return;
        }
        setIsSaving(true);
        setStatus('');
        try {
            await onSave(Number(ano), mes, attendance);
            // The success modal is now handled by the parent component (App.tsx)
        } catch (error) {
            // The error modal is now handled by the parent component (App.tsx)
            console.error("Save failed:", error);
        } finally {
            setIsSaving(false);
        }
    };
    
    const inputClasses = "w-full p-2 box-border border border-gray-300 rounded-md text-center";
    const readonlyInputClasses = `${inputClasses} bg-gray-200 font-bold border-gray-300 cursor-not-allowed`;

    return (
        <div className="container mx-auto max-w-4xl bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">INFORME DE ASISTENCIA A LAS REUNIONES</h2>
            <p className="text-center text-gray-600 text-sm mb-6">(La asistencia se contará una sola vez a mitad de cada reunión. Recuerden contar también a las personas aisladas o confinadas en casa que estén conectadas).</p>
            
            <div className="mb-4">
                <label className="block mb-1 font-bold text-gray-700">Nombre de la congregación:</label>
                <input type="text" value="Cong. Cerro de La Silla Guadalupe" readOnly className={readonlyInputClasses.replace('text-center', 'text-left')} />
            </div>
            
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label htmlFor="mes" className="block mb-1 font-bold text-gray-700">Mes:</label>
                        <select id="mes" name="mes" value={mes} onChange={e => setMes(e.target.value)} required className="w-full p-2 box-border border border-gray-300 rounded-md">
                            <option value="">-- Seleccione Mes --</option>
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="ano" className="block mb-1 font-bold text-gray-700">Año:</label>
                        <input type="number" id="ano" name="ano" value={ano} onChange={e => setAno(e.target.value)} required placeholder="Ej: 2025" min="2000" max="2100" className={inputClasses.replace('text-center', 'text-left')} />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="p-2 border border-gray-300 text-left">Reunión</th>
                                {[...Array(5)].map((_, i) => <th key={i} className="p-2 border border-gray-300 whitespace-nowrap">{['Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta'][i]} semana</th>)}
                                <th className="p-2 border border-gray-300">Total</th>
                                <th className="p-2 border border-gray-300">Promedio</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="p-2 border border-gray-300 font-bold">Reunión de entre semana</td>
                                {([...Array(5)] as number[]).map((_, i) => <td key={i} className="p-1 border border-gray-300"><input type="number" name={`es_sem${i+1}`} value={attendance[`es_sem${i+1}` as keyof AsistenciaData]} onChange={handleInputChange} className={inputClasses} /></td>)}
                                <td className="p-1 border border-gray-300"><input type="text" value={totals.es_total} readOnly className={readonlyInputClasses} /></td>
                                <td className="p-1 border border-gray-300"><input type="text" value={totals.es_promedio} readOnly className={readonlyInputClasses} /></td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-gray-300 font-bold">Reunión del fin de semana</td>
                                {([...Array(5)] as number[]).map((_, i) => <td key={i} className="p-1 border border-gray-300"><input type="number" name={`fs_sem${i+1}`} value={attendance[`fs_sem${i+1}` as keyof AsistenciaData]} onChange={handleInputChange} className={inputClasses} /></td>)}
                                <td className="p-1 border border-gray-300"><input type="text" value={totals.fs_total} readOnly className={readonlyInputClasses} /></td>
                                <td className="p-1 border border-gray-300"><input type="text" value={totals.fs_promedio} readOnly className={readonlyInputClasses} /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div className="text-center mt-8">
                    <button type="submit" disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 disabled:bg-gray-400">
                        {isSaving ? 'Guardando...' : 'Guardar / Actualizar'}
                    </button>
                </div>
            </form>

            <div id="status" className="text-center mt-4 font-bold min-h-[1.5rem] text-blue-700">{status}</div>
        </div>
    );
};

export default AsistenciaForm;