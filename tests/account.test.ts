import { describe, expect, it, vi } from 'vitest';
import { updateCredentials } from '../src/lib/account';
const user={id:'player-id',email:'old@example.test'};
const fixture=()=>({getUser:vi.fn().mockResolvedValue({data:{user},error:null}),signInWithPassword:vi.fn().mockResolvedValue({data:{user},error:null}),updateUser:vi.fn().mockResolvedValue({data:{user},error:null})});
type Auth=Parameters<typeof updateCredentials>[0];
describe('modifica credenziali',()=>{
  it('verifica identità e password prima di inviare una sola modifica combinata',async()=>{
    const auth=fixture();
    const result=await updateCredentials(auth as unknown as Auth,user.id,{email:'NEW@EXAMPLE.TEST',password:'NewPassword123',currentPassword:'OldPassword123'},'https://club.example');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({email:user.email,password:'OldPassword123'});
    expect(auth.updateUser).toHaveBeenCalledOnce();
    expect(auth.updateUser).toHaveBeenCalledWith({email:'new@example.test',password:'NewPassword123',current_password:'OldPassword123'},{emailRedirectTo:'https://club.example'});
    expect(result).toEqual({email:user.email,pendingEmail:'new@example.test',passwordChanged:true});
  });
  it('non modifica nulla con password attuale errata',async()=>{
    const auth=fixture();auth.signInWithPassword.mockResolvedValue({data:{user:null},error:{code:'invalid_credentials'}});
    await expect(updateCredentials(auth as unknown as Auth,user.id,{password:'NewPassword123',currentPassword:'WrongPassword'},'https://club.example')).rejects.toThrow('password attuale non è corretta');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it('non aggiorna un account differente da quello della sessione',async()=>{
    const auth=fixture();
    await expect(updateCredentials(auth as unknown as Auth,'other-player',{password:'NewPassword123',currentPassword:'OldPassword123'},'https://club.example')).rejects.toThrow('Sessione scaduta');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();expect(auth.updateUser).not.toHaveBeenCalled();
    auth.signInWithPassword.mockResolvedValue({data:{user:{...user,id:'other-player'}},error:null});
    await expect(updateCredentials(auth as unknown as Auth,user.id,{password:'NewPassword123',currentPassword:'OldPassword123'},'https://club.example')).rejects.toThrow('verificare l’account');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it('aggiorna solo la password senza inviare email o valori vuoti',async()=>{
    const auth=fixture();
    const result=await updateCredentials(auth as unknown as Auth,user.id,{password:'NewPassword123',currentPassword:'OldPassword123'},'https://club.example');
    expect(auth.updateUser.mock.calls[0][0]).toEqual({password:'NewPassword123',current_password:'OldPassword123'});
    expect(result).toEqual({email:user.email,pendingEmail:undefined,passwordChanged:true});
  });
  it('segnala una email già usata senza dichiarare aggiornamenti riusciti',async()=>{
    const auth=fixture();auth.updateUser.mockResolvedValue({data:{user:null},error:{code:'email_exists'}});
    await expect(updateCredentials(auth as unknown as Auth,user.id,{email:'duplicate@example.test',currentPassword:'OldPassword123'},'https://club.example')).rejects.toThrow('già utilizzata');
  });
});
