// Check localStorage data
const employees = JSON.parse(localStorage.getItem('classflow_employees') || '[]');
console.log('Total Employees:', employees.length);
if (employees.length > 0) {
  console.log('Sample Employee:', {
    name: employees[0].name,
    nationalId: employees[0].nationalId,
    id: employees[0].id
  });
}
